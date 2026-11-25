import { liveTargetOf, POINT_MIX } from "@/lib/live"
import { PER } from "@/lib/per"
import { raceWin } from "@/lib/race"
import type { EpaRow } from "@/lib/epa"
import type { PooleanState } from "@/lib/types"

// Wins added: Points added turned into wins, against an average player (not a "replacement": in a league of about a dozen friends there
// is no one to call up, and setting the bar at whoever plays least only singles them out). A player who adds `d` points a game moves
// their team's share of the scoring from half to (half + d/2 of an average game's points), and the race to the target (race.ts, the
// league's usual mix of 1s, 2s and 3s) turns that share into a chance of winning. Shown to everyone from WINS_SHOW_AT filmed games; until
// then one game swings it too much, so only editors see it, marked as a preview.

export const WINS_SHOW_AT = 15 // filmed games before visitors see it
export const THIN_GAMES = 8 // a player with fewer games than this is an early read

// The chance of winning a game to `target` between even teams when one team adds `d` points over an average game (PER points).
export function winChanceWith(d: number, target: number): number {
  const share = Math.min(0.95, Math.max(0.05, 0.5 + d / (2 * PER)))
  return raceWin(0, 0, target, share, POINT_MIX)
}

export interface WinsRow {
  id: string
  perGame: number // wins added per game
  total: number // over the games they played
  games: number
}

export function winsAdded(rows: EpaRow[], target: number): WinsRow[] {
  return rows
    .map((r) => {
      const perGame = winChanceWith(r.perGame, target) - 0.5
      return { id: r.id, perGame, total: perGame * r.gamesWorth, games: r.games }
    })
    .sort((a, b) => b.total - a.total)
}

// The score most filmed games were played to.
export function usualTarget(state: PooleanState): number {
  const counts = new Map<number, number>()
  for (const g of state.games) if (g.scoringEvents.length && !g.liveInProgress) counts.set(liveTargetOf(g), (counts.get(liveTargetOf(g)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 21
}
