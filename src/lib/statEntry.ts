// Pure event mutations for Stat Entry. Every function takes a Game and returns a NEW Game with
// derived box-score stats recomputed (recomputeDerivedStats), mirroring the classic site's rules
// in app.js (commitTaggedEvent, removeTaggedEvent, the shot Confirm handler, normalizeGame).
import { recomputeDerivedStats } from "./legacy-core"
import type { Game, ScoringEvent, TurnoverEvent } from "./types"

export type TagKind = "tov" | "stl" | "pf"
export type EventRef = { kind: "shot" | TagKind; id: string }

const TAG_KEY = { tov: "turnoverEvents", stl: "stealEvents", pf: "foulEvents" } as const

export interface ShotInput {
  scorerId: string
  points: 1 | 2 | 3
  made: boolean
  assistId?: string | null
  // "none" = self-created, null = not set. Makes always derive it from assistId.
  passerId?: string | null
  rebounderId?: string | null
  // Miss only, and only with a rebounder: who contested the rebound, or nobody did.
  reboundContesterIds?: string[]
  reboundNoContest?: boolean
  blockerId?: string | null
  defenderIds?: string[]
  contestLevel?: ScoringEvent["contestLevel"]
  shotType?: string | null
  dunk?: boolean
  shotLocation?: { x: number; y: number } | null
  // Miss only: ruled out of bounds, which creates a linked turnover (missEventId / turnoverEventId).
  outOfBounds?: boolean
  videoTime?: number | null
}

function uid(prefix: string) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function finish(g: Game): Game {
  recomputeDerivedStats(g)
  return g
}

// The same fixups normalizeGame applies on load: no defender means "none" contest, a make's
// passer is its assister (or "none" when unassisted).
function fixShot(ev: ScoringEvent) {
  const made = ev.made !== false
  const fg = ev.points !== 1
  ev.defenderIds = ev.defenderIds ?? []
  ev.contestLevel = ev.defenderIds.length === 0 ? "none" : (ev.contestLevel ?? null)
  if (made) {
    ev.blockerId = null
    ev.rebounderId = null
    ev.passerId = ev.assistId || "none"
  } else {
    ev.assistId = null
    if (ev.turnoverEventId) ev.rebounderId = null
  }
  // A rebound battle only exists on a live-ball miss with a rebounder; naming contesters means someone contested.
  if (made || !ev.rebounderId || ev.turnoverEventId) {
    ev.reboundContesterIds = []
    ev.reboundNoContest = false
  } else if ((ev.reboundContesterIds ?? []).length > 0) {
    ev.reboundNoContest = false
  }
  if (!fg) {
    ev.shotLocation = null
    ev.dunk = false
    ev.shotType = null
  } else if (ev.dunk) {
    ev.shotType = null
  }
}

// Baskets that were only scored live (points, no shots). Offered for import only while the game has no shot log.
export const liveBaskets = (g: Game) => [...(g.liveScores ?? []), ...(g.scorekeeperScores ?? [])]
export const pendingBaskets = (g: Game): number => (g.liveInProgress || g.scoringEvents.length > 0 ? 0 : liveBaskets(g).length)

// Turns each live basket into a made shot by that player, so the box score has its points at once and the details
// (assists, misses, rebounds, defenders) can be added to those shots afterward. The live list is cleared so the same
// baskets cannot be imported twice.
export function importLiveBaskets(game: Game): Game {
  if (pendingBaskets(game) === 0) return game
  const roster = new Set([...game.teamA, ...game.teamB])
  let g = game
  for (const b of liveBaskets(game)) if (roster.has(b.pid) && [1, 2, 3].includes(b.points)) g = addShot(g, { scorerId: b.pid, points: b.points as 1 | 2 | 3, made: true })
  return { ...g, liveScores: [], scorekeeperScores: [] }
}

export function addShot(game: Game, input: ShotInput): Game {
  const g = structuredClone(game)
  const id = uid("score")
  const ev: ScoringEvent = {
    id,
    scorerId: input.scorerId,
    points: input.points,
    made: input.made,
    defenderIds: [...(input.defenderIds ?? [])],
    assistId: input.assistId ?? null,
    blockerId: input.blockerId ?? null,
    turnoverEventId: null,
    rebounderId: input.outOfBounds ? null : (input.rebounderId ?? null),
    reboundContesterIds: [...(input.reboundContesterIds ?? [])],
    reboundNoContest: input.reboundNoContest ?? false,
    shotLocation: input.shotLocation ?? null,
    dunk: input.dunk ?? false,
    shotType: input.shotType ?? null,
    contestLevel: input.contestLevel ?? null,
    passerId: input.made ? null : (input.passerId ?? null),
    videoTime: input.videoTime ?? null,
  }
  fixShot(ev)
  g.scoringEvents.push(ev)
  if (!input.made && input.outOfBounds) {
    // Credit whoever forced it out: the blocker, else the lone defender (a double team is ambiguous).
    const opponentId = ev.blockerId || (ev.defenderIds!.length === 1 ? ev.defenderIds![0] : null)
    const tovId = uid("tov")
    g.turnoverEvents.push({ id: tovId, playerId: input.scorerId, opponentId, stealEventId: null, missEventId: id, videoTime: ev.videoTime })
    ev.turnoverEventId = tovId
  }
  return finish(g)
}

// Like the classic Shot Log edit: who is tagged and how, never scorer/points/make-vs-miss/out of
// bounds (those change which other records exist, so fixing them means delete and re-log).
export type ShotPatch = Partial<Pick<ShotInput, "assistId" | "passerId" | "rebounderId" | "reboundContesterIds" | "reboundNoContest" | "blockerId" | "defenderIds" | "contestLevel" | "shotType" | "dunk" | "shotLocation" | "videoTime">>

export function editShot(game: Game, id: string, patch: ShotPatch): Game {
  const g = structuredClone(game)
  const ev = g.scoringEvents.find((e) => e.id === id)
  if (!ev) return game
  Object.assign(ev, patch)
  fixShot(ev)
  return finish(g)
}

// Removing a shot also removes its out-of-bounds turnover.
export function deleteShot(game: Game, id: string): Game {
  const g = structuredClone(game)
  const ev = g.scoringEvents.find((e) => e.id === id)
  g.scoringEvents = g.scoringEvents.filter((e) => e.id !== id)
  g.turnoverEvents = g.turnoverEvents.filter((t) => t.id !== ev?.turnoverEventId && t.missEventId !== id)
  return finish(g)
}

// A steal always creates the paired turnover for the victim (stealEventId links them): the steal's
// playerId is the stealer, opponentId the victim. Turnover/foul create a single record.
export function addTagged(
  game: Game,
  kind: TagKind,
  playerId: string,
  opponentId: string | null,
  videoTime: number | null,
  turnoverType?: string | null,
): Game {
  if (kind === "stl" && !opponentId) throw new Error("A steal needs the player it was stolen from")
  const g = structuredClone(game)
  if (kind === "stl") {
    const stealId = uid("stl")
    g.stealEvents.push({ id: stealId, playerId, opponentId: opponentId!, videoTime })
    g.turnoverEvents.push({ id: uid("tov"), playerId: opponentId!, opponentId: playerId, stealEventId: stealId, videoTime })
  } else if (kind === "tov") {
    g.turnoverEvents.push({ id: uid("tov"), playerId, opponentId, stealEventId: null, videoTime, turnoverType: turnoverType ?? null })
  } else {
    g.foulEvents.push({ id: uid("pf"), playerId, opponentId, videoTime })
  }
  return finish(g)
}

// Removing either half of a steal/turnover pair removes both; removing an out-of-bounds turnover
// un-marks its shot (the shot stays).
export function deleteTagged(game: Game, kind: TagKind, id: string): Game {
  const g = structuredClone(game)
  if (kind === "stl") {
    g.stealEvents = g.stealEvents.filter((e) => e.id !== id)
    g.turnoverEvents = g.turnoverEvents.filter((e) => e.stealEventId !== id)
  } else if (kind === "tov") {
    const ev = g.turnoverEvents.find((e) => e.id === id)
    g.turnoverEvents = g.turnoverEvents.filter((e) => e.id !== id)
    if (ev?.stealEventId) g.stealEvents = g.stealEvents.filter((e) => e.id !== ev.stealEventId)
    if (ev?.missEventId) {
      const miss = g.scoringEvents.find((e) => e.id === ev.missEventId)
      if (miss) miss.turnoverEventId = null
    }
  } else {
    g.foulEvents = g.foulEvents.filter((e) => e.id !== id)
  }
  return finish(g)
}

export interface TagPatch {
  playerId?: string
  opponentId?: string | null
  videoTime?: number | null
  turnoverType?: string | null
}

// Linked turnovers (from a steal or an out-of-bounds miss) keep their players, which the link
// defines; only time and type change. Editing a steal keeps its paired turnover in sync.
export function editTagged(game: Game, kind: TagKind, id: string, patch: TagPatch): Game {
  const g = structuredClone(game)
  const list = g[TAG_KEY[kind]] as (TurnoverEvent & { turnoverType?: string | null })[]
  const ev = list.find((e) => e.id === id)
  if (!ev) return game
  if (kind === "tov" && (ev.stealEventId || ev.missEventId)) {
    delete patch.playerId
    delete patch.opponentId
  }
  if (kind === "stl" && patch.opponentId === null) delete patch.opponentId
  if (kind !== "tov") delete patch.turnoverType
  Object.assign(ev, patch)
  if (kind === "stl") {
    const tov = g.turnoverEvents.find((t) => t.stealEventId === id)
    if (tov) Object.assign(tov, { playerId: ev.opponentId, opponentId: ev.playerId, videoTime: ev.videoTime })
  }
  if (kind === "tov" && ev.stealEventId && patch.videoTime !== undefined) {
    const stl = g.stealEvents.find((s) => s.id === ev.stealEventId)
    if (stl) stl.videoTime = patch.videoTime
  }
  return finish(g)
}

export function deleteEvent(game: Game, ref: EventRef): Game {
  return ref.kind === "shot" ? deleteShot(game, ref.id) : deleteTagged(game, ref.kind, ref.id)
}

// ids are prefix_<base36 time><5 random chars> (uid), so the newest event is the largest embedded
// time; events from older id formats are skipped, falling back to the last shot, then last other.
function idTime(id: string): number {
  const m = /^[a-z]+_([0-9a-z]+)$/.exec(id)
  return m && m[1].length > 5 ? parseInt(m[1].slice(0, -5), 36) : -1
}

export function lastEvent(game: Game): EventRef | null {
  const all: EventRef[] = [
    ...game.scoringEvents.map((e) => ({ kind: "shot" as const, id: e.id })),
    ...game.turnoverEvents.filter((e) => !e.stealEventId && !e.missEventId).map((e) => ({ kind: "tov" as const, id: e.id })),
    ...game.stealEvents.map((e) => ({ kind: "stl" as const, id: e.id })),
    ...game.foulEvents.map((e) => ({ kind: "pf" as const, id: e.id })),
  ]
  if (all.length === 0) return null
  let best: EventRef | null = null
  let bestT = -1
  for (const r of all) {
    const t = idTime(r.id)
    if (t >= bestT && t >= 0) {
      best = r
      bestT = t
    }
  }
  if (best) return best
  const lastShot = game.scoringEvents[game.scoringEvents.length - 1]
  return lastShot ? { kind: "shot", id: lastShot.id } : all[all.length - 1]
}

export function undoLast(game: Game): Game {
  const ref = lastEvent(game)
  return ref ? deleteEvent(game, ref) : game
}

export function setStoppedEarly(game: Game, v: boolean): Game {
  return { ...game, stoppedEarly: v }
}

// "m:ss.t" text for the time field; parseVideoTimeInput (legacy-core) reads it back.
export function timeToInput(t: number | null | undefined): string {
  if (t === null || t === undefined) return ""
  const m = Math.floor(t / 60)
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, "0")}`
}

const DIRECT_VIDEO = /\.(mp4|webm|mov|m4v|ogv|ogg)(?:[?#].*)?$/i
export function isDirectVideoUrl(url: string | undefined | null): url is string {
  return !!url && (url.startsWith("blob:") || DIRECT_VIDEO.test(url))
}

// ---- the rest of Stat Entry: court side, defensive matchups, highlight / lowlight clips.
// These do not change the box score, so they only replace the lists on the game.
export function setDirection(game: Game, dir: "left" | "right" | null): Game {
  return { ...game, teamADirection: dir }
}

export function addMatchup(game: Game, m: { defenderId: string; offenderId: string; note?: string; videoTime?: number | null }): Game {
  return { ...game, matchups: [...(game.matchups ?? []), { id: uid("matchup"), ...m }] }
}

export function deleteMatchup(game: Game, id: string): Game {
  return { ...game, matchups: (game.matchups ?? []).filter((m) => m.id !== id) }
}

export function addPlay(game: Game, p: { type: "highlight" | "lowlight"; start: number; end: number; playerId?: string | null; note?: string }): Game {
  return { ...game, plays: [...(game.plays ?? []), { id: uid("play"), ...p }] }
}

export function deletePlay(game: Game, id: string): Game {
  return { ...game, plays: (game.plays ?? []).filter((p) => p.id !== id) }
}
