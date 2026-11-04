import { scoreOf } from "@/lib/nightRecap"
import { computeLeaderboard, isCurrentSeasonGame } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// The offseason is the stretch before opening night, once the editor has set its date.
export function openingAt(state: PooleanState): Date | null {
  const o = state.openingNight
  if (!o?.date) return null
  const d = new Date(`${o.date}T${o.time || "00:00"}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export const isOffseason = (state: PooleanState, now = new Date()): boolean => {
  const at = openingAt(state)
  return !!at && at.getTime() > now.getTime()
}

// The season just played: finished games with a result in the current season. During the offseason this is the season
// that just ended, until the editor starts a new one.
export function seasonGames(state: PooleanState): Game[] {
  return state.games
    .filter((g) => !g.liveInProgress && g.date && isCurrentSeasonGame(state, g))
    .filter((g) => {
      const [a, b] = scoreOf(g)
      return a !== b
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const seasonState = (state: PooleanState): PooleanState => ({ ...state, games: seasonGames(state) })

// The way-too-early power ranking: this season's two-way per 20, at least 3 games, with each player's record.
export function powerRanking(state: PooleanState) {
  return computeLeaderboard(seasonState(state))
    .filter((r) => r.gp >= 3)
    .sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
}

// Who goes on a preseason ballot: everyone who played this season, best by the numbers first, then the rest by most
// games. Before anyone has played, the whole roster.
export function ballotPool(state: PooleanState): string[] {
  const games = seasonGames(state)
  if (games.length === 0) return state.players.map((p) => p.id)
  const gp = new Map<string, number>()
  for (const g of games) for (const id of [...g.teamA, ...g.teamB]) gp.set(id, (gp.get(id) ?? 0) + 1)
  const ranked = powerRanking(state).map((r) => r.player.id)
  const rest = [...gp.keys()].filter((id) => !ranked.includes(id) && state.players.some((p) => p.id === id)).sort((a, b) => (gp.get(b) ?? 0) - (gp.get(a) ?? 0))
  return [...ranked, ...rest]
}
