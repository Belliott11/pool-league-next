// State shape, ported from poolean-turnover-type-spec.md / INTEGRATION.md's documented schema
// (see dashboard/README.md "Data schema (JSON)"). Only the fields this app's first slice reads
// are typed strictly; everything else stays loosely typed so a real export round-trips untouched.

import type { TradeOffer } from "@/lib/seasonTrades"

export interface Player {
  id: string
  name: string
  // Which pronouns headlines use for this player. Unset means they/them.
  pronouns?: "he" | "she"
  // The editor's own notes on the player's Scouting Card, one per section, saved with the player.
  scout?: { strengths?: string; workOn?: string; guard?: string; sample?: string }
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
  contestLevel?: "none" | "beat" | "light" | "medium" | "heavy" | null
  contestChecked?: boolean // an old Light Contest tag someone has looked at again
  // Shots off a pass: true when the shot starts in one motion from the catch (feet can gather; no fake, dribble or pause), false when
  // the shooter held it first. Says whether a contest was on the pass or on the shooter.
  catchAndShoot?: boolean | null
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

// An editor's call on one candidate clip, from the Review clips list. `key` is clips.ts reviewKey (when and who).
export interface ClipReview {
  key: string
  verdict: "keep" | "skip"
  still?: { time: number; playerId: string } // a frame the editor picked by hand, not one of the logged plays
  frame?: { z: number; x: number; y: number } // the crop, as stillCache.ts Frame
  track?: { t: number; x: number; y: number }[] // where the ball or player is through the clip (0..1 of the picture); the camera follows it, zoomed to frame.z
  from?: number // where the clip starts and ends in the recording, in seconds, when the editor trimmed it
  to?: number
  note?: string // what happens in it, in the editor's words: the caption, and what a headline is matched against
  who?: string[] // everyone in the shot
  looks?: Record<string, "good" | "bad"> // how a player comes across in it; "bad" keeps it off that player's own pages
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
  teamsPickedBy?: "balanced" | "captains" | "random" | "runback"
  rules?: string // house rules that night
  liveTarget?: number // the score it was played to
  test?: boolean // a live game for trying things out: no alerts, no Pick'em, and it is discarded when it ends
  videoUrl?: string
  videoPath?: string
  // Seconds into the video where this game begins, for one recording shared by several games.
  videoStart?: number
  masterVideoId?: string | null
  liveInProgress?: boolean
  // The model's call, saved when the game was set up: team A's chance to win. Never filled in after the fact.
  prediction?: { pA: number; at: string }
  liveScores?: { pid: string; points: number; bid?: string; at?: number }[] // at: when it was scored (ms since 1970), for placing it in a recording later
  // When a live game started and finished (ISO times). With a recording's own start time, these place the game in it.
  startedAt?: string
  endedAt?: string
  // The live stream of this game (an unlisted YouTube live link), watched with replay buttons; it becomes the game's video when it ends.
  streamUrl?: string
  // Moments someone flagged for a second look during a live game ("Review that"), lined up with the recording afterward.
  reviews?: Review[]
  recordedAt?: string // when this game's own video started recording, when it has its own file
  // Baskets added by friends using the scorekeeper code; folded into liveScores when the game is finished.
  scorekeeperScores?: { pid: string; points: number; bid?: string; at?: number }[]
  matchups?: { id: string; defenderId: string; offenderId: string; note?: string; videoTime?: number | null }[]
  clipReviews?: ClipReview[]
  plays?: { id: string; type: "highlight" | "lowlight"; start: number; end: number; playerId?: string | null; note?: string }[]
  // every other field (matchups, plays, videoUrl, masterVideoId, …) round-trips via this index
  [key: string]: unknown
}

export interface Rsvp {
  id: string
  date: string
  // When the night starts, "HH:MM" on a 24-hour clock in local time. Optional.
  time?: string
  playerIds: string[]
}

// One recording that several games share (a whole night). Each game keeps its own start and end inside it.
// A clarification of a rule: how the league reads it, added by the editor on the Rules page.
export interface RuleNote {
  id: string
  section: string // the rulebook section's title, such as "Boundaries"
  text: string
  date: string // when it was added, YYYY-MM-DD
  gap?: string // the open question it answers (ruleGaps' key), which then leaves "Not in the rulebook yet"
}

export interface Review {
  id: string
  at: number // when it was flagged, ms since 1970
  note?: string // what is in question, such as "Ben says goaltend"
  by?: string // who flagged it, a player id, when known
  videoTime?: number // set by hand when the recording's start time is not known
  verdict?: "stands" | "overturned" // what the group decided after watching
}

export interface MasterVideo {
  id: string
  name: string
  recordedAt?: string // when the recording started (from the file), for placing games and baskets by the clock
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
  // Used only while writing headlines, laid over the state in memory. Labels are private and never saved here.
  playerLabels?: Record<string, string[]>
  // Finished headlines the editor has saved, so visitors see the jokes without ever seeing the labels behind them.
  publishedStories?: { nights?: Record<string, { quick: string[]; full: string[] }>; going?: string[]; season?: string[]; preview?: string[] }
  // The editor's call on who a headline is about and whether it is good or bad for them, set from the film button beside it. Overrides
  // src/data/headline-tones.json; null means no clip for that headline.
  headlineTones?: Record<string, [string, "good" | "bad"] | null>
  currentSeasonStartedAt?: string | null
  // Seasons already closed, oldest first: each one's name and dates (see newSeason.ts).
  seasonHistory?: { label: string; startedAt: string | null; endedAt: string }[]
  // Season teams (seasonTeams.ts): teams that exist only in the stats for a season, drafted by captains. The last set without `to` is
  // the current one.
  seasonTeamSets?: SeasonTeamSet[]
  // Play of the Year brackets (playOfYear.ts), newest last. Votes live in the poty_votes table, never here.
  playOfYear?: PlayOfYear[]
  // Season awards voted by the players (awardVote.ts), newest last. Votes live in the award_votes table, never here.
  awardBallots?: AwardBallot[]
  // The league's own rulings on Poolean's rules (rulesLookup.ts), each tied to a rulebook section by its title.
  ruleNotes?: RuleNote[]
  // The first night of next season. While it is in the future the app is in the offseason.
  openingNight?: { date: string; time?: string } | null
  [key: string]: unknown
}

// A Play of the Year bracket: the seeded plays (share ids from clip-shares.json, best first), when voting opened and how long each round
// stays open. Who won each match is worked out from the votes.
export interface AwardBallot {
  id: string
  label: string // "Summer 2026"
  awards: string[] // award keys in reveal order, MVP last
  candidates: string[] // who can be voted for, frozen when the vote starts
  open: boolean // taking votes
  revealed: number // how many awards have been revealed, in `awards` order
  startedAt: string
  lastAt?: string // the last open, close or reveal, for refreshing phones during a reveal
}

export interface PlayOfYear {
  id: string
  label: string
  seeds: string[]
  startAt: string
  days: number
  // Live: everyone votes in the same room, one matchup at a time; the editor opens each (openMatch) and closes it (closed, in order).
  live?: boolean
  openMatch?: string | null
  closed?: string[]
  lastAt?: string // when the editor last opened or closed a matchup
}

// One season team: a name, a color, its captain and its members (the captain included), in the order they were drafted.
export interface SeasonTeam {
  id: string
  name: string
  color: string
  captain: string | null
  members: string[]
}

// A season's teams: they count every finished game from `from` up to `to` (the next season's start, set when it begins). While
// `drafting` is set the captains are still picking.
export interface SeasonTeamSet {
  id: string
  from: string
  to?: string | null
  label?: string
  teams: SeasonTeam[]
  drafting?: boolean
  // Trades and newcomers after the draft: who moved, from which team (null: new) to which (null: left), from what date. A player's
  // nights count for the team they were on that night.
  moves?: { pid: string; from: string | null; to: string | null; date: string }[]
  // Game nights planned for the season, for the title odds (titleOdds.ts). Unset: DEFAULT_NIGHTS.
  nights?: number
  // Phone draft: each captain's link key, hashed (sha-256 hex) so the public league data cannot be used to pick. Set by the editor.
  captainKeys?: Record<string, string>
  lastPickAt?: string
  // Finals night: seeds (team ids, best first) frozen from the standings when the editor starts it, and the date rivalry games start
  // counting for the bracket (seasonTeams.ts, `finals`).
  finals?: { from: string; seeds: string[] }
  // Draft lottery night (draftLottery.ts): the drawn first-round order (team ids, first pick first), each team's balls, and how many
  // picks have been revealed, counted from the last pick. The teams are reordered once every pick is shown.
  lottery?: { mode: "weighted" | "even"; balls: Record<string, number>; order: string[]; revealed: number; at: string }
  // Trade offers between captains (seasonTrades.ts): made and answered from captains' phones through the season-draft function, approved
  // by the editor.
  offers?: TradeOffer[]
}
