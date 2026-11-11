import { uid } from "@/lib/format"
import type { Game } from "@/lib/types"

// Who guards whom, from the game's own matchups list (id, videoTime, defenderId, offenderId, note). Nothing about how the
// list is stored changes. An entry holds until that defender gets a newer one, and a defender covering two offenders just
// has two entries at the same time.
export type Entry = NonNullable<Game["matchups"]>[number]

export const TIPOFF_SLACK = 10 // seconds after the first logged play that still count as tip-off

const everyone = (g: Game) => [...g.teamA, ...g.teamB]
const opponentsOf = (g: Game, id: string) => (g.teamA.includes(id) ? g.teamB : g.teamA)
const times = (g: Game) => [...g.scoringEvents.map((e) => e.videoTime), ...g.turnoverEvents.map((x) => x.videoTime)].filter((t): t is number => typeof t === "number")

// Where in the video the game begins: its own start, else its first logged play, else the start of the file.
export function tipoffTime(g: Game): number {
  if (typeof g.videoStart === "number") return g.videoStart
  const t = times(g)
  return t.length ? Math.min(...t) : 0
}

// Entries at or before this point were set at tip-off.
export function tipoffCutoff(g: Game): number {
  const t = times(g)
  return Math.max(tipoffTime(g), t.length ? Math.min(...t) : 0) + TIPOFF_SLACK
}

// What each defender is guarding at a moment (or right now, with no time given): the offenders in their newest entry up to then.
export function assignmentsAt(g: Game, t?: number | null): Map<string, string[]> {
  const by = new Map<string, Entry[]>()
  for (const e of g.matchups ?? []) {
    if (typeof t === "number" && typeof e.videoTime === "number" && e.videoTime > t) continue
    by.set(e.defenderId, [...(by.get(e.defenderId) ?? []), e])
  }
  const out = new Map<string, string[]>()
  for (const [d, list] of by) {
    const newest = Math.max(...list.map((e) => e.videoTime ?? -1))
    out.set(d, [...new Set(list.filter((e) => (e.videoTime ?? -1) === newest).map((e) => e.offenderId))])
  }
  return out
}

export interface Tipoff {
  assigned: number
  total: number
  missing: string[] // defenders with nobody assigned at tip-off
}

export function tipoffStatus(g: Game): Tipoff {
  const at = assignmentsAt(g, tipoffCutoff(g))
  const missing = everyone(g).filter((id) => !at.has(id))
  return { assigned: everyone(g).length - missing.length, total: everyone(g).length, missing }
}

// Sets this defender's assignment at a moment: anything of theirs at that exact time is replaced, so a later tap just changes it.
export function setAssignment(g: Game, defenderId: string, offenderIds: string[], time: number | null): Game {
  const kept = (g.matchups ?? []).filter((e) => !(e.defenderId === defenderId && (e.videoTime ?? null) === time))
  const added = offenderIds.filter((o) => opponentsOf(g, defenderId).includes(o)).map((offenderId) => ({ id: uid("matchup"), defenderId, offenderId, note: "", videoTime: time }))
  return { ...g, matchups: [...kept, ...added] }
}

// A new set at a moment with every defender's current assignment carried over, for when nothing changed.
export function sameAsLast(g: Game, time: number | null): Game {
  let next = g
  for (const [d, offenders] of assignmentsAt(g, time)) next = setAssignment(next, d, offenders, time)
  return next
}

// A defender on the smaller team has to cover two offenders for the teams to match up.
export const coversTwo = (g: Game, id: string) => opponentsOf(g, id).length > (g.teamA.includes(id) ? g.teamA : g.teamB).length
