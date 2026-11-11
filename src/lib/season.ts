import { isCurrentSeasonGame } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// Which games a panel reads. Panels about how someone is playing now (rates, defense, passing, the reads) follow the season start and
// the Include Past Seasons toggle. League-wide questions (the shot-quality yardstick, Does it hold up?, By format, win impact, careers)
// always use every game, since more data only makes them better.
//
// The season view keeps every game in `leagueGames`, so the shot-quality yardstick inside it stays all-time. It is built for reading
// only and is never saved.
export type SeasonView = PooleanState & { leagueGames?: Game[] }

export function seasonView(state: PooleanState, includePast: boolean): SeasonView {
  if (includePast || !state.currentSeasonStartedAt) return state
  return { ...state, games: state.games.filter((g) => isCurrentSeasonGame(state, g)), leagueGames: state.games }
}

// Every game, even when handed a season view: for the league-wide yardstick.
export const allGamesOf = (state: SeasonView): Game[] => state.leagueGames ?? state.games

// True when a season has started and its games are being shown on their own.
export const isSeasonOnly = (state: SeasonView) => !!state.leagueGames
