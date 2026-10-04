// State shape, ported from poolean-turnover-type-spec.md / INTEGRATION.md's documented schema
// (see dashboard/README.md "Data schema (JSON)"). Only the fields this app's first slice reads
// are typed strictly; everything else stays loosely typed so a real export round-trips untouched.

export interface Player {
  id: string
  name: string
}

export interface PlayerGameStats {
  playerId: string
  pts: number
  oreb: number
  dreb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
}

export interface ScoringEvent {
  id: string
  scorerId: string
  points: 1 | 2 | 3
  made?: boolean
  assistId?: string | null
  defenderIds?: string[]
  blockerId?: string | null
  turnoverEventId?: string | null
  rebounderId?: string | null
  shotLocation?: { x: number; y: number } | null
  videoTime?: number | null
  shotType?: string | null
  dunk?: boolean
  contestLevel?: "none" | "light" | "medium" | "heavy" | null
  passerId?: string | null
}

export interface TurnoverEvent {
  id: string
  playerId: string
  opponentId?: string | null
  stealEventId?: string | null
  missEventId?: string | null
  videoTime?: number | null
  turnoverType?: string | null
}

export interface Game {
  id: string
  date: string
  notes?: string
  winner?: "A" | "B" | null
  teamA: string[]
  teamB: string[]
  stats: PlayerGameStats[]
  scoringEvents: ScoringEvent[]
  turnoverEvents: TurnoverEvent[]
  stealEvents: { id: string; playerId: string; opponentId: string; videoTime?: number | null }[]
  foulEvents: { id: string; playerId: string; opponentId?: string | null; videoTime?: number | null }[]
  stoppedEarly?: boolean
  videoUrl?: string
  videoPath?: string
  // Seconds into the video where this game begins, for one recording shared by several games.
  videoStart?: number
  masterVideoId?: string | null
  liveInProgress?: boolean
  liveScores?: { pid: string; points: number }[]
  matchups?: { id: string; defenderId: string; offenderId: string; note?: string; videoTime?: number | null }[]
  plays?: { id: string; type: "highlight" | "lowlight"; start: number; end: number; playerId?: string | null; note?: string }[]
  // every other field (matchups, plays, videoUrl, masterVideoId, …) round-trips via this index
  [key: string]: unknown
}

export interface Rsvp {
  id: string
  date: string
  playerIds: string[]
}

export interface PooleanState {
  players: Player[]
  games: Game[]
  rsvps?: Rsvp[]
  currentSeasonStartedAt?: string | null
  [key: string]: unknown
}
