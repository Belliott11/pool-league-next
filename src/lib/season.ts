import type { Game, PooleanState } from "@/lib/types"

// Which games a panel reads. Panels about how someone is playing now (rates, defense, passing, the reads) follow the season. League-wide
// questions (the shot-quality yardstick, Does it hold up?, By format, win impact, careers) always use every game.
//
// A new season starts thin, so until it has SEASON_MIN_GAMES filmed games of its own, the season stats also count the most recent
// filmed games from before it, enough to make up the difference. As the season fills in, the old games drop away on their own.
export const SEASON_MIN_GAMES = 15

const filmed = (g: Game) => !g.liveInProgress && g.scoringEvents.length > 0

export interface Carry {
  start: string // the season's own start
  from: string // where the season stats start counting
  seasonGames: number // filmed games this season
  carried: number // filmed games from before the season that still count
}

// Where the season stats start counting: the season start, or earlier while the season is short of SEASON_MIN_GAMES filmed games.
// Whole nights are carried, so a night is never split.
export function carryOver(state: PooleanState): Carry | null {
  const start = state.currentSeasonStartedAt
  if (!start) return null
  const games = state.games.filter(filmed)
  const seasonGames = games.filter((g) => (g.date || "") >= start).length
  const before = games.filter((g) => (g.date || "") < start).sort((a, b) => (b.date || "").localeCompare(a.date || ""))
  const need = Math.max(0, SEASON_MIN_GAMES - seasonGames)
  if (need === 0 || before.length === 0) return { start, from: start, seasonGames, carried: 0 }
  const from = before[Math.min(need, before.length) - 1].date || start
  return { start, from, seasonGames, carried: before.filter((g) => (g.date || "") >= from).length }
}

// The view a season panel reads. It keeps every game in `leagueGames`, so the shot-quality yardstick inside it stays all-time. It is
// built for reading only and is never saved.
export type SeasonView = PooleanState & { leagueGames?: Game[] }

export function seasonView(state: PooleanState, includePast: boolean): SeasonView {
  const c = carryOver(state)
  if (includePast || !c) return state
  return { ...state, games: state.games.filter((g) => (g.date || "") >= c.from), leagueGames: state.games }
}

// Every game, even when handed a season view: for the league-wide yardstick.
export const allGamesOf = (state: SeasonView): Game[] => state.leagueGames ?? state.games

// True when a season has started and its games are being shown without the full history.
export const isSeasonOnly = (state: SeasonView) => !!state.leagueGames

// One line for the panels while last season is still being counted.
export function carryNote(state: PooleanState, includePast: boolean): string | null {
  const c = carryOver(state)
  if (includePast || !c || c.carried === 0) return null
  return `This season has ${c.seasonGames} filmed ${c.seasonGames === 1 ? "game" : "games"}, so these stats also count the last ${c.carried} from before it. They drop out once the season has ${SEASON_MIN_GAMES}.`
}
