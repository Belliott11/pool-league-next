import type { Game, PooleanState } from "@/lib/types"

// A finished, real game logged shot by shot (not live, not a test game): what the shot-based models count.
export const isFilmed = (g: Game) => g.scoringEvents.length > 0 && !g.liveInProgress && !g.test
export const filmedGames = (state: PooleanState) => state.games.filter(isFilmed)
