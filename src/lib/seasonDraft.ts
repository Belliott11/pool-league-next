// The snake draft's rules: whose pick it is, making a pick, taking one back. This file must not import anything: the season-draft edge
// function runs a byte-for-byte copy (supabase/functions/season-draft/seasonDraft.ts, checked by draftRoom.test.ts), so a captain's phone and
// the editor's screen follow the same order.

export interface DraftTeam {
  id: string
  captain: string | null
  members: string[]
}

export interface DraftSet<T extends DraftTeam = DraftTeam> {
  teams: T[]
}

export function picksMade(set: DraftSet): number {
  return set.teams.reduce((k, t) => k + t.members.filter((m) => m !== t.captain).length, 0)
}

const teamAt = <T extends DraftTeam>(set: DraftSet<T>, pick: number): T => {
  const n = set.teams.length
  const round = Math.floor(pick / n)
  const slot = pick % n
  return set.teams[round % 2 === 0 ? slot : n - 1 - slot]
}

export function onTheClock<T extends DraftTeam>(set: DraftSet<T>): T | null {
  return set.teams.length ? teamAt(set, picksMade(set)) : null
}

export function draftPick<S extends DraftSet>(set: S, pid: string): S {
  const t = onTheClock(set)
  if (!t || set.teams.some((x) => x.members.includes(pid))) return set
  return { ...set, teams: set.teams.map((x) => (x.id === t.id ? { ...x, members: [...x.members, pid] } : x)) }
}

// Takes back the last pick (never a captain).
export function undoPick<S extends DraftSet>(set: S): S {
  const picked = picksMade(set)
  if (!picked) return set
  const t = teamAt(set, picked - 1)
  return { ...set, teams: set.teams.map((x) => (x.id === t.id ? { ...x, members: x.members.slice(0, -1) } : x)) }
}
