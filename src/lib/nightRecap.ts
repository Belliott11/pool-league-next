import { getGameStats, isLiveScoreOnly, liveScoreOf, teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// One game day boiled down: every game's result, each player's night, and a few headline moments. Games that
// were only scored live (no shot log) count with their points; games with a box score add rebounds, assists,
// steals and blocks.
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
  boxGames: number // games with a box score behind the extras
  best: number // most points in one game
}

export interface NightSummary {
  date: string
  games: NightGame[]
  players: NightPlayer[]
  totalPoints: number
  topScorer: NightPlayer | null
  mostWins: NightPlayer | null
  biggestWin: NightGame | null
  closest: NightGame | null
}

// The dates that have games, newest first.
export function gameDays(state: PooleanState): string[] {
  return [...new Set(state.games.map((g) => g.date).filter(Boolean))].sort().reverse()
}

function scoreOf(g: Game): [number, number] {
  return isLiveScoreOnly(g) || g.liveInProgress ? [liveScoreOf(g, g.teamA), liveScoreOf(g, g.teamB)] : [teamScore(g, g.teamA), teamScore(g, g.teamB)]
}

export function summarizeNight(state: PooleanState, date: string): NightSummary {
  const games: NightGame[] = []
  const players = new Map<string, NightPlayer>()
  const row = (id: string): NightPlayer => {
    let p = players.get(id)
    if (!p) players.set(id, (p = { id, games: 0, wins: 0, losses: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, boxGames: 0, best: 0 }))
    return p
  }

  for (const g of state.games.filter((x) => x.date === date)) {
    const [a, b] = scoreOf(g)
    const live = !!g.liveInProgress
    const liveOnly = isLiveScoreOnly(g) || live
    const winner = a > b ? "A" : b > a ? "B" : null
    games.push({ id: g.id, teamA: g.teamA, teamB: g.teamB, scoreA: a, scoreB: b, winner, live, liveOnly })
    if (live) continue // a game in progress has no result yet
    for (const side of ["A", "B"] as const) {
      for (const id of side === "A" ? g.teamA : g.teamB) {
        const p = row(id)
        p.games++
        if (winner === side) p.wins++
        else if (winner) p.losses++
        const s = liveOnly ? null : getGameStats(g, id)
        const pts = liveOnly ? liveScoreOf(g, [id]) : (s?.pts ?? 0)
        p.pts += pts
        p.best = Math.max(p.best, pts)
        if (s) {
          p.boxGames++
          p.reb += s.oreb + s.dreb
          p.ast += s.ast
          p.stl += s.stl
          p.blk += s.blk
        }
      }
    }
  }

  const list = [...players.values()].sort((x, y) => y.pts - x.pts || y.wins - x.wins)
  const done = games.filter((g) => !g.live && g.winner)
  const margin = (g: NightGame) => Math.abs(g.scoreA - g.scoreB)
  const topScorer = list[0] && list[0].pts > 0 ? list[0] : null
  const wins = [...list].sort((x, y) => y.wins - x.wins || y.pts - x.pts)[0]
  return {
    date,
    games,
    players: list,
    totalPoints: games.reduce((n, g) => n + g.scoreA + g.scoreB, 0),
    topScorer,
    mostWins: wins && wins.wins > 0 ? wins : null,
    biggestWin: done.length ? done.reduce((m, g) => (margin(g) > margin(m) ? g : m)) : null,
    closest: done.length > 1 ? done.reduce((m, g) => (margin(g) < margin(m) ? g : m)) : null,
  }
}

// The same recap as plain text, for pasting into a group chat.
export function recapText(state: PooleanState, s: NightSummary, dateLabel: string, name: (id: string) => string): string {
  const names = (ids: string[]) => ids.map(name).join(", ")
  const lines = [`Poolean Intel: ${dateLabel}`, `${s.games.length} game${s.games.length === 1 ? "" : "s"}, ${s.totalPoints} points`, ""]
  s.games.forEach((g, i) => lines.push(`Game ${i + 1}${g.live ? " (live)" : ""}: ${names(g.teamA)} ${g.scoreA} - ${g.scoreB} ${names(g.teamB)}`))
  if (s.topScorer) lines.push("", `Top scorer: ${name(s.topScorer.id)}, ${s.topScorer.pts} pts`)
  if (s.mostWins) lines.push(`Most wins: ${name(s.mostWins.id)}, ${s.mostWins.wins}-${s.mostWins.losses}`)
  if (s.biggestWin) lines.push(`Biggest win: ${s.biggestWin.scoreA}-${s.biggestWin.scoreB}`)
  if (s.closest) lines.push(`Closest game: ${s.closest.scoreA}-${s.closest.scoreB}`)
  void state
  return lines.join("\n")
}
