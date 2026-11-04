import { teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// The stored winner flag only decides games with no box score. A game that has one is decided by its score, so a flag
// that says otherwise is just stale data (for example from an import). This corrects only that case: the flag is
// "A" or "B", the game has a box score and a clear winner, and the two disagree. Ties and unset flags are left alone.
// Returns the same object when nothing needed fixing.
export function syncWinnerFlags(state: PooleanState): PooleanState {
  let changed = false
  const games = state.games.map((g: Game) => {
    if (g.liveInProgress || g.scoringEvents.length === 0 || (g.winner !== "A" && g.winner !== "B")) return g
    const a = teamScore(g, g.teamA)
    const b = teamScore(g, g.teamB)
    const actual: "A" | "B" | null = a > b ? "A" : b > a ? "B" : null
    if (!actual || actual === g.winner) return g
    changed = true
    return { ...g, winner: actual }
  })
  return changed ? { ...state, games } : state
}
