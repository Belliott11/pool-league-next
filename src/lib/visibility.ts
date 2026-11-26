import type { PooleanState } from "@/lib/types"

// Season teams were hidden from visitors until the players agreed (asked 2026-11-26); shown to everyone from 2026-11-26. The editor sees and sets up everything as
// usual; visitors get the league data without the season teams, so the Games home button, the page, the player chip, the rivalry badge,
// the Hall of Fame board and the Wrapped line all stay away. Set to true to show them to everyone. A captain's draft link opens on a
// visitor's phone, so turn this on before a phone draft.
export const SEASON_TEAMS_PUBLIC = true

export const forVisitors = (s: PooleanState): PooleanState => (SEASON_TEAMS_PUBLIC || !s.seasonTeamSets ? s : { ...s, seasonTeamSets: undefined })
