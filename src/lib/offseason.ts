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

// Opening night itself: from midnight of its date until 8 hours after it starts. The hub turns into a live board.
export const isOpeningNight = (state: PooleanState, now = new Date()): boolean => {
  const at = openingAt(state)
  if (!at || state.openingNight?.date !== now.toLocaleDateString("en-CA")) return false
  return now.getTime() < at.getTime() + 8 * 3600 * 1000
}

// The hub shows before opening night and through the night itself.
export const showHub = (state: PooleanState, now = new Date()) => isOffseason(state, now) || isOpeningNight(state, now)

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

// Who goes on a preseason ballot: every player in the app. The starting order is best by the numbers first, then the
// rest of this season's players by most games, then everyone else by name.
export function ballotPool(state: PooleanState): string[] {
  const gp = new Map<string, number>()
  for (const g of seasonGames(state)) for (const id of [...g.teamA, ...g.teamB]) gp.set(id, (gp.get(id) ?? 0) + 1)
  const ranked = powerRanking(state).map((r) => r.player.id)
  const rest = [...state.players]
    .filter((p) => !ranked.includes(p.id))
    .sort((a, b) => (gp.get(b.id) ?? 0) - (gp.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .map((p) => p.id)
  return [...ranked, ...rest]
}
