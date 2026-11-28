import { sizeAllowed } from "@/lib/filters"
import { playerLine } from "@/lib/nightRecap"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import { computeLeaderboard, defensiveRating, gameDefenseStats, getGameStats, isCurrentSeasonGame } from "@/lib/stats"
import { DEFAULT_NIGHTS } from "@/lib/titleOdds"
import type { PooleanState } from "@/lib/types"

// Award odds: each player's chance of finishing first in the MVP race (total two-way), Best player (two-way per game) and Defender (total
// defensive score) once the season's planned nights are played, the same measures as the award race (awardRace.ts). Thousands of runs of
// the nights left: each night a player comes with their own attendance so far (leaned on the league's by LEAN_NIGHTS nights), plays their
// usual number of games, and each game is filmed as often as this season's are; a filmed game adds a line drawn from that player's level
// (their games so far leaned on the league average by LEAN games, the level itself uncertain by as much) plus the game-to-game spread seen
// across everyone. Ties share the win. Only while the season is under way; season length is the current season-team set's planned nights,
// else DEFAULT_NIGHTS.

export const LEAN = 4
export const LEAN_NIGHTS = 2
export const RUNS = 4000
export const ODDS_KEYS = ["mvp", "best-player", "dpoy"] as const
export type OddsKey = (typeof ODDS_KEYS)[number]

export interface AwardOdds {
  nightsPlayed: number
  nightsLeft: number
  odds: Record<OddsKey, { id: string; chance: number }[]>
}

type Me = { id: string; games: number; nights: number; boxed: number; two: number[]; def: number[]; perGame: number }

// A seeded normal draw (Box-Muller over mulberry32), so everyone sees the same odds for the same data.
function random(seed: number) {
  let s = seed >>> 0
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return { u, n: () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u()) }
}

export function awardOdds(state: PooleanState, opts: { planned?: number; runs?: number; seed?: number } = {}): AwardOdds | null {
  const games = state.games.filter((g) => !g.liveInProgress && !g.test && g.date && isCurrentSeasonGame(state, g) && sizeAllowed(g))
  if (!games.length) return null
  const dates = [...new Set(games.map((g) => g.date))]
  const set = (state.seasonTeamSets ?? []).filter((x) => !x.to).at(-1)
  const planned = Math.max(opts.planned ?? set?.nights ?? DEFAULT_NIGHTS, dates.length)
  const nightsLeft = planned - dates.length
  const filmedShare = games.filter((g) => g.scoringEvents.length > 0).length / games.length

  const me = new Map<string, Me>()
  const get = (id: string) => me.get(id) ?? me.set(id, { id, games: 0, nights: 0, boxed: 0, two: [], def: [], perGame: 0 }).get(id)!
  for (const d of dates) for (const id of new Set(games.filter((g) => g.date === d).flatMap((g) => [...g.teamA, ...g.teamB]))) get(id).nights++
  for (const g of games)
    for (const id of [...g.teamA, ...g.teamB]) {
      const m = get(id)
      m.games++
      if (g.scoringEvents.length === 0) continue
      const l = playerLine(g, id)
      if (l.twoWay === null) continue
      m.boxed++
      m.two.push(l.twoWay)
      m.def.push(defensiveRating(getGameStats(g, id), gameDefenseStats(g, id)))
    }
  for (const r of computeLeaderboard({ ...state, games })) if (me.has(r.player.id)) me.get(r.player.id)!.perGame = r.twoWayPer25
  const all = [...me.values()]
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0)
  const spread = (pick: (m: Me) => number[]) => {
    let ss = 0, n = 0
    for (const m of all) {
      const v = pick(m)
      const mu = mean(v)
      for (const x of v) (ss += (x - mu) ** 2), n++
    }
    return n > all.length ? Math.sqrt(ss / (n - all.length)) : 5
  }
  const leagueTwo = mean(all.flatMap((m) => m.two))
  const leagueDef = mean(all.flatMap((m) => m.def))
  const sdTwo = spread((m) => m.two)
  const sdDef = spread((m) => m.def)
  const attendLeague = mean(all.map((m) => m.nights / dates.length))
  const level = (v: number[], league: number) => (v.reduce((a, x) => a + x, 0) + LEAN * league) / (v.length + LEAN)

  const wins: Record<OddsKey, Map<string, number>> = { mvp: new Map(), "best-player": new Map(), dpoy: new Map() }
  const runs = nightsLeft > 0 ? (opts.runs ?? RUNS) : 1
  const { u, n } = random(opts.seed ?? 20261128)
  for (let run = 0; run < runs; run++) {
    const end = all.map((m) => {
      // This run's level for the player, uncertain by the spread over the games it rests on.
      const k = m.two.length + LEAN
      const two = level(m.two, leagueTwo) + (n() * sdTwo) / Math.sqrt(k)
      const def = level(m.def, leagueDef) + (n() * sdDef) / Math.sqrt(k)
      const attend = (m.nights + LEAN_NIGHTS * attendLeague) / (dates.length + LEAN_NIGHTS)
      const perNight = m.nights ? m.games / m.nights : 2
      let games = m.games, boxed = m.boxed, totTwo = m.two.reduce((a, x) => a + x, 0), totDef = m.def.reduce((a, x) => a + x, 0), addTwo = 0
      for (let night = 0; night < nightsLeft; night++) {
        if (u() >= attend) continue
        const g = Math.floor(perNight) + (u() < perNight - Math.floor(perNight) ? 1 : 0)
        for (let j = 0; j < g; j++) {
          games++
          if (u() >= filmedShare) continue
          boxed++
          const t = two + n() * sdTwo
          totTwo += t
          addTwo += t
          totDef += def + n() * sdDef
        }
      }
      const per = boxed ? (m.perGame * m.boxed + addTwo) / boxed : 0
      return { id: m.id, ok: games >= MIN_RANKED && boxed >= 2, totTwo, totDef, per }
    })
    const ok = end.filter((e) => e.ok)
    const award = (key: OddsKey, val: (e: (typeof ok)[number]) => number) => {
      if (!ok.length) return
      const best = Math.max(...ok.map(val))
      const top = ok.filter((e) => val(e) === best)
      for (const e of top) wins[key].set(e.id, (wins[key].get(e.id) ?? 0) + 1 / top.length)
    }
    award("mvp", (e) => e.totTwo)
    award("best-player", (e) => e.per)
    award("dpoy", (e) => e.totDef)
  }
  const list = (m: Map<string, number>) => [...m].map(([id, w]) => ({ id, chance: w / runs })).sort((a, b) => b.chance - a.chance)
  return { nightsPlayed: dates.length, nightsLeft, odds: { mvp: list(wins.mvp), "best-player": list(wins["best-player"]), dpoy: list(wins.dpoy) } }
}
