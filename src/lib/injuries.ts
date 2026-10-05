import type { Injury, InjuryStatus, PooleanState } from "@/lib/types"

// The injury board: who is away or out for a bit, in the style of a sports news ticker. Statuses are ordered
// from most to least serious so the worst cases sit at the top.
export const INJURY_STATUSES: { key: InjuryStatus; label: string; tone: "neg" | "gold" | "muted" | "pos" }[] = [
  { key: "out", label: "OUT", tone: "neg" },
  { key: "away", label: "AWAY", tone: "muted" },
  { key: "questionable", label: "QUESTIONABLE", tone: "gold" },
  { key: "dayToDay", label: "DAY-TO-DAY", tone: "gold" },
  { key: "returning", label: "RETURNING", tone: "pos" },
]

export const statusInfo = (key: InjuryStatus) => INJURY_STATUSES.find((s) => s.key === key) ?? INJURY_STATUSES[0]

// Silly notes to start from. No pronouns, so they read right for anyone.
const GOOFY: Record<InjuryStatus, string[]> = {
  out: [
    "Rolled an ankle reaching for the last slice.",
    "Pulled something opening a pickle jar.",
    "Back went out. The couch is under investigation.",
    "Stubbed a toe and is selling it for all it is worth.",
    "Sidelined by an aggressive stretch in the driveway.",
    "Doctor's orders: no jumping, no fun, no contested layups.",
  ],
  away: [
    "Out of town, probably on a boat.",
    "On vacation. Tan lines pending.",
    "Working, allegedly.",
    "Visiting family and eating well. Back soon.",
    "Off the grid. Last seen near a lake.",
  ],
  questionable: [
    "Says it is fine. Limping to the cooler though.",
    "Warmups consisted entirely of stretching the story.",
    "Listed as questionable by a very biased source.",
    "Game-time decision, pending snack availability.",
  ],
  dayToDay: [
    "Sore from last week's heroics.",
    "Legs say yes, knees say no.",
    "Taking it easy after a rough landing.",
    "Moving slowly, talking fast.",
  ],
  returning: [
    "Back in full practice. Looked dangerous in the driveway.",
    "Cleared to play and feeling it.",
    "Returns from the shadow realm with fresh legs.",
    "Ready to go, rust level unknown.",
  ],
}

export function goofyNote(status: InjuryStatus, avoid?: string): string {
  const pool = GOOFY[status].filter((n) => n !== avoid)
  return pool[Math.floor(Math.random() * pool.length)] ?? GOOFY[status][0]
}

// Everyone currently on the board: worst status first, then newest.
export function injuryBoard(state: PooleanState): Injury[] {
  const rank = (s: InjuryStatus) => INJURY_STATUSES.findIndex((x) => x.key === s)
  return [...(state.injuries ?? [])]
    .filter((i) => state.players.some((p) => p.id === i.playerId))
    .sort((a, b) => rank(a.status) - rank(b.status) || b.updatedAt.localeCompare(a.updatedAt))
}

// Players not expected tonight: out, or away.
export function unavailable(state: PooleanState): Injury[] {
  return injuryBoard(state).filter((i) => i.status === "out" || i.status === "away")
}
