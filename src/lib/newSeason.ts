import type { PooleanState } from "./types"

// Closing one season and starting the next. It only records dates: the season that ends goes into `seasonHistory` with its name, and the
// new one starts on `date`. Every game, player, recording (`masterVideos`, the shared videos all clips play from), label and setting is
// kept. Season panels then follow the new season (borrowing the latest games from before it until it has 15 of its own, see season.ts),
// and records and the Hall of Fame stay all-time.
export function startNewSeason(state: PooleanState, date: string, label?: string): PooleanState {
  const name = (label ?? "").trim() || suggestSeasonName(state, date)
  return {
    ...state,
    seasonHistory: [...(state.seasonHistory ?? []), { label: name, startedAt: state.currentSeasonStartedAt ?? null, endedAt: date }],
    currentSeasonStartedAt: date,
    // The ending season's teams stop counting games from the new season on (their standings are kept for the Hall of Fame). Teams set up
    // for the new season (starting on or after it) are left open.
    ...(state.seasonTeamSets?.length ? { seasonTeamSets: state.seasonTeamSets.map((t) => (t.to || t.from >= date ? t : { ...t, to: date, label: t.label ?? name })) } : {}),
  }
}

// "Summer 2026": the year of the latest game before the new season (the league plays in summer).
export function suggestSeasonName(state: PooleanState, date: string): string {
  const last = state.games.map((g) => g.date || "").filter((d) => d && d < date).sort().at(-1)
  return `Summer ${(last ?? date).slice(0, 4)}`
}

// Opening night has come (or passed) and its season has not been started yet: the editor is asked to start it.
export function seasonDue(state: PooleanState, today = new Date().toLocaleDateString("en-CA")): string | null {
  const open = state.openingNight?.date
  if (!open || open > today) return null
  return (state.currentSeasonStartedAt ?? "") >= open ? null : open
}
