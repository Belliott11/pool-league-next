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
  // Rebound battles: who was matched up on the rebounder, or reboundNoContest when nobody was.
  reboundContesterIds?: string[]
  reboundNoContest?: boolean
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
  // Baskets added by friends using the scorekeeper code; folded into liveScores when the game is finished.
  scorekeeperScores?: { pid: string; points: number }[]
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

// One recording that several games share (a whole night). Each game keeps its own start and end inside it.
export interface MasterVideo {
  id: string
  name: string
  fileName?: string | null
  url?: string
  path?: string
}

export type InjuryStatus = "out" | "away" | "questionable" | "dayToDay" | "returning"

// A line on the injury board: who is away or banged up, and a note about it.
export interface Injury {
  id: string
  playerId: string
  status: InjuryStatus
  note: string
  updatedAt: string // ISO time of the last change
  // How long the absence is expected to last: a day or two, a week or two, or a long time.
  timeline?: "dayToDay" | "weeks" | "longTerm"
  until?: string | null // older entries carried an expected date; no longer shown
}

export interface PooleanState {
  players: Player[]
  games: Game[]
  rsvps?: Rsvp[]
  masterVideos?: MasterVideo[]
  injuries?: Injury[]
  // Labels assigned to players on the Players tab (a library key or custom text), used to personalize headlines.
  playerLabels?: Record<string, string[]>
  currentSeasonStartedAt?: string | null
  [key: string]: unknown
}
