import { gameDefenseStats, getGameStats, isLiveScoreOnly, liveScoreOf, shootingStats, teamScore, twoWayScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// One game day boiled down: every game's result, each player's night, and a few headline moments. Games that
// were only scored live (no shot log) count with their points; games with a box score add rebounds, assists,
// steals, blocks, threes and the two-way score.
export interface NightGame {
  id: string
  teamA: string[]
  teamB: string[]
  scoreA: number
  scoreB: number
  winner: "A" | "B" | null
  live: boolean // still being played
  liveOnly: boolean // scored live, no box score
}

// One player in one game. Everything past pts needs a box score; twoWay is null without one.
export interface PlayerLine {
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  tpm: number
  ftm: number
  twoWay: number | null
  box: boolean
}

export function playerLine(g: Game, id: string): PlayerLine {
  if (g.scoringEvents.length === 0) {
    const pts = (g.liveScores?.length ?? 0) + (g.scorekeeperScores?.length ?? 0) > 0 ? liveScoreOf(g, [id]) : getGameStats(g, id).pts
    return { pts, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, tpm: 0, ftm: 0, twoWay: null, box: false }
  }
  const s = getGameStats(g, id)
  const sh = shootingStats(g, id)
  const def = gameDefenseStats(g, id)
  return { pts: s.pts, reb: s.oreb + s.dreb, ast: s.ast, stl: s.stl, blk: s.blk, tov: s.tov, tpm: sh.tpm, ftm: sh.ftm, twoWay: twoWayScore(s, sh, def), box: true }
}

export interface NightPlayer {
  id: string
  games: number
  wins: number
  losses: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  tov: number
  tpm: number
  ftm: number
  twoWay: number // summed over games with a box score
  boxGames: number // games with a box score behind the extras
  best: number // most points in one game
}

export type LeaderKey = "pts" | "reb" | "ast" | "stl" | "blk" | "tpm"
export const LEADER_LABEL: Record<LeaderKey, string> = { pts: "Points", reb: "Rebounds", ast: "Assists", stl: "Steals", blk: "Blocks", tpm: "Threes" }

export interface Lineup {
  ids: string[]
  games: number
  wins: number
  pf: number
  pa: number
}

export interface NightSummary {
  date: string
  games: NightGame[]
  players: NightPlayer[]
  totalPoints: number
  topScorer: NightPlayer | null
  mostWins: NightPlayer | null
  mvp: NightPlayer | null // highest total two-way score, box score games only
  leaders: Record<LeaderKey, NightPlayer[]>
  duos: Lineup[]
  trios: Lineup[]
  biggestWin: NightGame | null
  closest: NightGame | null
}

// The dates that have games, newest first.
export function gameDays(state: PooleanState): string[] {
  return [...new Set(state.games.map((g) => g.date).filter(Boolean))].sort().reverse()
}

export function scoreOf(g: Game): [number, number] {
  return isLiveScoreOnly(g) || g.liveInProgress ? [liveScoreOf(g, g.teamA), liveScoreOf(g, g.teamB)] : [teamScore(g, g.teamA), teamScore(g, g.teamB)]
}

function combos(ids: string[], size: number): string[][] {
  const out: string[][] = []
  const go = (start: number, cur: string[]) => {
    if (cur.length === size) return void out.push([...cur])
    for (let i = start; i < ids.length; i++) go(i + 1, [...cur, ids[i]])
  }
  go(0, [])
  return out
}

function lineups(done: { g: Game; a: number; b: number }[], size: number): Lineup[] {
  const map = new Map<string, Lineup>()
  for (const { g, a, b } of done) {
    for (const side of ["A", "B"] as const) {
      const ids = [...(side === "A" ? g.teamA : g.teamB)].sort()
      const pf = side === "A" ? a : b
      const pa = side === "A" ? b : a
      for (const c of combos(ids, size)) {
        const k = c.join("|")
        const row = map.get(k) ?? { ids: c, games: 0, wins: 0, pf: 0, pa: 0 }
        row.games++
        row.pf += pf
        row.pa += pa
        if (pf > pa) row.wins++
        map.set(k, row)
      }
    }
  }
  const all = [...map.values()]
  // Groups that played together more than once are the real signal; fall back to one-game groups on a short night.
  const repeat = all.filter((l) => l.games >= 2)
  const pool = repeat.length >= 2 ? repeat : all
  return pool.sort((x, y) => (y.pf - y.pa) / y.games - (x.pf - x.pa) / x.games || y.games - x.games).slice(0, 3)
}

export function summarizeNight(state: PooleanState, date: string): NightSummary {
  const games: NightGame[] = []
  const done: { g: Game; a: number; b: number }[] = []
  const players = new Map<string, NightPlayer>()
  const row = (id: string): NightPlayer => {
    let p = players.get(id)
    if (!p) players.set(id, (p = { id, games: 0, wins: 0, losses: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, tpm: 0, ftm: 0, twoWay: 0, boxGames: 0, best: 0 }))
    return p
  }

  for (const g of state.games.filter((x) => x.date === date)) {
    const [a, b] = scoreOf(g)
    const live = !!g.liveInProgress
    const liveOnly = isLiveScoreOnly(g) || live
    const winner = a > b ? "A" : b > a ? "B" : null
    games.push({ id: g.id, teamA: g.teamA, teamB: g.teamB, scoreA: a, scoreB: b, winner, live, liveOnly })
    if (live) continue // a game in progress has no result yet
    done.push({ g, a, b })
    for (const side of ["A", "B"] as const) {
      for (const id of side === "A" ? g.teamA : g.teamB) {
        const p = row(id)
        p.games++
        if (winner === side) p.wins++
        else if (winner) p.losses++
        const line = playerLine(g, id)
        p.pts += line.pts
        p.best = Math.max(p.best, line.pts)
        if (line.box) {
          p.boxGames++
          p.reb += line.reb
          p.ast += line.ast
          p.stl += line.stl
          p.blk += line.blk
          p.tov += line.tov
          p.tpm += line.tpm
          p.ftm += line.ftm
          p.twoWay += line.twoWay ?? 0
        }
      }
    }
  }

  const list = [...players.values()].sort((x, y) => y.pts - x.pts || y.wins - x.wins)
  const finished = games.filter((g) => !g.live && g.winner)
  const margin = (g: NightGame) => Math.abs(g.scoreA - g.scoreB)
  const topScorer = list[0] && list[0].pts > 0 ? list[0] : null
  const wins = [...list].sort((x, y) => y.wins - x.wins || y.pts - x.pts)[0]
  const boxed = list.filter((p) => p.boxGames > 0)
  const mvp = boxed.length ? [...boxed].sort((x, y) => y.twoWay - x.twoWay)[0] : null
  const top = (key: LeaderKey) =>
    [...(key === "pts" ? list : boxed)]
      .filter((p) => p[key] > 0)
      .sort((x, y) => y[key] - x[key] || y.pts - x.pts)
      .slice(0, 3)
  return {
    date,
    games,
    players: list,
    totalPoints: games.reduce((n, g) => n + g.scoreA + g.scoreB, 0),
    topScorer,
    mostWins: wins && wins.wins > 0 ? wins : null,
    mvp,
    leaders: { pts: top("pts"), reb: top("reb"), ast: top("ast"), stl: top("stl"), blk: top("blk"), tpm: top("tpm") },
    duos: lineups(done, 2),
    trios: lineups(done, 3),
    biggestWin: finished.length ? finished.reduce((m, g) => (margin(g) > margin(m) ? g : m)) : null,
    closest: finished.length > 1 ? finished.reduce((m, g) => (margin(g) < margin(m) ? g : m)) : null,
  }
}

// The same recap as plain text, for pasting into a group chat.
export function recapText(s: NightSummary, dateLabel: string, name: (id: string) => string, stories: string[] = []): string {
  const names = (ids: string[]) => ids.map(name).join(", ")
  const lines = [`Poolean Intel: ${dateLabel}`, `${s.games.length} game${s.games.length === 1 ? "" : "s"}, ${s.totalPoints} points`, ""]
  s.games.forEach((g, i) => lines.push(`Game ${i + 1}${g.live ? " (live)" : ""}: ${names(g.teamA)} ${g.scoreA} - ${g.scoreB} ${names(g.teamB)}`))
  if (s.mvp) lines.push("", `Night MVP: ${name(s.mvp.id)} (two-way ${s.mvp.twoWay.toFixed(1)})`)
  if (s.topScorer) lines.push(`Top scorer: ${name(s.topScorer.id)}, ${s.topScorer.pts} pts`)
  if (s.mostWins) lines.push(`Most wins: ${name(s.mostWins.id)}, ${s.mostWins.wins}-${s.mostWins.losses}`)
  if (stories.length) lines.push("", ...stories.slice(0, 4).map((x) => `- ${x}`))
  return lines.join("\n")
}
