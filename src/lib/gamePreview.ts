import { scoreOf } from "@/lib/nightRecap"
import { computeLeaderboard, type LeaderboardRow } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

export type Result = "W" | "L" | "T"

// A player's last results before a game, oldest first. Games on the same date count when they came earlier in the list.
export function recentForm(state: PooleanState, id: string, game: Game, n = 5): Result[] {
  const at = state.games.indexOf(game)
  return state.games
    .filter((g, i) => g.id !== game.id && !g.liveInProgress && g.date && (g.date < game.date || (g.date === game.date && i < at)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((g): Result[] => {
      const onA = g.teamA.includes(id)
      if (!onA && !g.teamB.includes(id)) return []
      const [a, b] = scoreOf(g)
      const mine = onA ? a : b
      const theirs = onA ? b : a
      return [mine > theirs ? "W" : mine < theirs ? "L" : "T"]
    })
    .slice(-n)
}

// The best all-around player of a side: highest two-way per 20 among those with a box score.
export function keyPlayer(rows: LeaderboardRow[], ids: string[]): LeaderboardRow | null {
  return rows.filter((r) => ids.includes(r.player.id) && r.gp > 0).sort((a, b) => b.twoWayPer20 - a.twoWayPer20)[0] ?? null
}

export const boardOf = (state: PooleanState) => computeLeaderboard(state)

// The other games played on the same date.
export const otherGamesThatNight = (state: PooleanState, game: Game): Game[] => state.games.filter((g) => g.id !== game.id && g.date === game.date && !g.liveInProgress)
