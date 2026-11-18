import { sizeAllowed } from "@/lib/filters"
import { playerLine } from "@/lib/nightRecap"
import { defensiveRating, gameDefenseStats, getGameStats, isCurrentSeasonGame } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

// Where the season is heading if it runs `more` filmed games like the ones so far. Each made-up game, a player shows up as often
// as they have so far and repeats one of their own past games, picked at random. Run many times, the share of runs a player ends
// on top is their chance at the award. The awards add up over the season (see awardRace.ts), so showing up counts.
// ponytail: replays a player's own games, so two or three games understate how much they could change. Pull thin samples toward
// the league before trusting a long shot.
export const MILESTONE = 50 // season points milestones come in steps of this
const MIN_GAMES = 2 // the same bar as the award race

export interface Projection {
  id: string
  now: number
  mid: number // the middle outcome
  lo: number // 1 run in 10 ends below this
  hi: number // 1 run in 10 ends above this
  win: number // share of runs that end first, 0 to 1
  vote: number // share of sample ballots they win, 0 to 1 (see sampleVote)
}
export interface Milestone {
  id: string
  pts: number
  next: number
  chance: number
}
export interface Season {
  games: number // filmed games so far this season
  more: number
  mvp: Projection[]
  defender: Projection[]
  milestones: Milestone[]
}

// Small seeded generator, so the same data always gives the same odds.
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Awards are voted, not counted. This runs sample ballots on the totals so far: each regular (3 or more games) ranks three others, never
// themselves, 3-2-1 points, seeing each player's total in standard deviations plus noise of one. The share of ballots a player wins
// (a tie splits) is the vote line. Last season's real ballots were close to this shape: about 8 voters, winners on 38% to 44% of the points.
// ponytail: the noise size is a guess, not fitted to anything; the old-site ballots carry no stats to fit it against.
const VOTE_NOISE = 1
const BALLOTS = 2000
function sampleVote(ids: string[], totals: number[], voters: string[]): number[] {
  const mean = totals.reduce((n, v) => n + v, 0) / totals.length
  const sd = Math.sqrt(totals.reduce((n, v) => n + (v - mean) ** 2, 0) / totals.length) || 1
  const rand = rng(7)
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
  const won = ids.map(() => 0)
  for (let k = 0; k < BALLOTS; k++) {
    const pts = ids.map(() => 0)
    for (const voter of voters) {
      ids
        .map((id, i) => ({ i, s: id === voter ? -Infinity : (totals[i] - mean) / sd + VOTE_NOISE * gauss() }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 3)
        .forEach((x, place) => x.s > -Infinity && (pts[x.i] += 3 - place))
    }
    const top = Math.max(...pts)
    const tied = pts.flatMap((p, i) => (p === top ? [i] : []))
    for (const i of tied) won[i] += 1 / tied.length
  }
  return won.map((w) => w / BALLOTS)
}

export function projectSeason(state: PooleanState, more = 20, sims = 2000): Season {
  const games = state.games.filter((g) => !g.liveInProgress && g.date && isCurrentSeasonGame(state, g) && g.scoringEvents.length > 0 && sizeAllowed(g))
  const lines = new Map<string, { twoWay: number; defense: number; pts: number }[]>()
  for (const g of games) {
    for (const id of [...g.teamA, ...g.teamB]) {
      const l = playerLine(g, id)
      if (l.twoWay === null) continue
      const list = lines.get(id) ?? lines.set(id, []).get(id)!
      list.push({ twoWay: l.twoWay, defense: defensiveRating(getGameStats(g, id), gameDefenseStats(g, id)), pts: l.pts })
    }
  }
  const ids = [...lines.keys()].filter((id) => lines.get(id)!.length >= MIN_GAMES)
  const empty = { games: games.length, more, mvp: [], defender: [], milestones: [] }
  if (ids.length === 0) return empty
  const KEYS = ["twoWay", "defense", "pts"] as const
  const now = ids.map((id) => KEYS.map((k) => lines.get(id)!.reduce((n, l) => n + l[k], 0)))
  const out = KEYS.map(() => ids.map(() => new Float64Array(sims)))
  const wins = KEYS.map(() => ids.map(() => 0))
  const rand = rng(20260101)
  for (let s = 0; s < sims; s++) {
    const best = [-Infinity, -Infinity]
    const who = [-1, -1]
    ids.forEach((id, i) => {
      const past = lines.get(id)!
      const show = past.length / games.length
      const t = [...now[i]]
      for (let g = 0; g < more; g++) {
        if (rand() >= show) continue
        const l = past[Math.floor(rand() * past.length)]
        KEYS.forEach((k, j) => (t[j] += l[k]))
      }
      KEYS.forEach((_, j) => (out[j][i][s] = t[j]))
      for (const j of [0, 1]) if (t[j] > best[j]) [best[j], who[j]] = [t[j], i]
    })
    for (const j of [0, 1]) wins[j][who[j]]++
  }
  const voters = [...lines.keys()].filter((id) => lines.get(id)!.length >= 3)
  const vote = [0, 1].map((j) => sampleVote(ids, now.map((n) => n[j]), voters))
  const at = (xs: Float64Array, q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))]
  const table = (j: number): Projection[] =>
    ids
      .map((id, i) => {
        const xs = out[j][i].slice().sort()
        return { id, now: now[i][j], mid: at(xs, 0.5), lo: at(xs, 0.1), hi: at(xs, 0.9), win: wins[j][i] / sims, vote: vote[j][i] }
      })
      .sort((a, b) => b.win - a.win || b.mid - a.mid)
  const milestones = ids
    .map((id, i) => {
      const pts = now[i][2]
      const next = (Math.floor(pts / MILESTONE) + 1) * MILESTONE
      return { id, pts, next, chance: out[2][i].filter((v) => v >= next).length / sims }
    })
    .sort((a, b) => a.next - a.pts - (b.next - b.pts))
  return { games: games.length, more, mvp: table(0), defender: table(1), milestones }
}
