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
    "Hurt a hamstring celebrating a basket that did not go in.",
    "Sprained something doing a layup in a mirror.",
    "Pulled a muscle explaining why the last call was a foul.",
    "Slipped on a puddle. The puddle is fine.",
    "Doctor says no jumping. Doctor has clearly never seen the jump.",
    "Out with a mystery injury. The mystery is why.",
    "Rolled an ankle on flat ground. Heroic.",
    "Doctor's orders: no cardio, no contested layups, no excuses left.",
  ],
  away: [
    "Out of town, probably on a boat.",
    "On vacation. Tan lines pending.",
    "Working, allegedly.",
    "Visiting family and eating well. Back soon.",
    "Off the grid. Last seen near a lake.",
    "At a wedding, dancing worse than any pickup game.",
    "Unreachable. Read receipts are doing a lot of work.",
    "Said they would be back by Friday. Friday is a state of mind.",
    "Chasing a sunset in a state with no hoops.",
    "Helping someone move a couch. Will resurface when the couch is placed.",
  ],
  questionable: [
    "Says it is fine. Limping to the cooler though.",
    "Warmups consisted entirely of stretching the story.",
    "Listed as questionable by a very biased source.",
    "Game-time decision, pending snack availability.",
    "Swears it is nothing, then asked for a chair.",
    "Playing through it. The it is a hangnail.",
    "Will decide when the vibes are right and the opponent is soft.",
    "Coin flip between playing and complaining about it.",
  ],
  dayToDay: [
    "Sore from last week's heroics.",
    "Legs say yes, knees say no.",
    "Taking it easy after a rough landing.",
    "Moving slowly, talking fast.",
    "Stiff after a long meeting. Truly a sports injury.",
    "Tweaked something and will not say what.",
    "Day-to-day, and today is looking like a no.",
    "Walking it off, extremely slowly.",
  ],
  returning: [
    "Back in full practice. Looked dangerous in the driveway.",
    "Cleared to play and feeling it.",
    "Returns from the shadow realm with fresh legs.",
    "Ready to go, rust level unknown.",
    "Back and talking big. Receipts to follow.",
    "Returns after a long rest and a lot of snacks.",
    "Medically cleared, spiritually unprepared.",
    "Back from the IR with something to prove, probably the wrong thing.",
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

// One-line headlines about the report as a whole, in the same spirit as the night recap. The wording for a given
// situation is fixed by the date, so it does not shuffle on refresh.
function pickOne(seed: string, ...options: string[]): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return options[h % options.length]
}

export function injuryHeadlines(state: PooleanState, name: (id: string) => string, now = new Date()): string[] {
  const board = injuryBoard(state)
  const day = now.toISOString().slice(0, 10)
  const out: string[] = []
  const hurt = board.filter((i) => i.status !== "returning")
  const outNow = board.filter((i) => i.status === "out")
  const roster = Math.max(state.players.length, 1)

  if (board.length === 0) return [pickOne(day, "Everyone is healthy. Suspiciously.", "A clean bill of health across the league. Somebody is lying.", "Zero injuries. Nobody is playing hard enough.")]

  if (hurt.length >= Math.max(3, roster / 3)) {
    out.push(pickOne(day + "many", `${hurt.length} players are hurt or away. This is a hospital with a hoop.`, `${hurt.length} on the report. The driveway needs a trainer and a better warmup.`, `A third of the league is on the IR. Stretching is free, you know.`))
  } else if (outNow.length === 1) {
    out.push(pickOne(day + "one", `${name(outNow[0].playerId)} is out. The rim is already lonely.`, `${name(outNow[0].playerId)} is on ice. The cooler has never been so well attended.`))
  } else if (outNow.length >= 2) {
    out.push(pickOne(day + "two", `${outNow.map((i) => name(i.playerId)).join(" and ")} are both out. The injury report is longer than the roster some nights.`, `${outNow.length} players out. Depth is a luxury nobody has.`))
  }

  // The longest-running case.
  const oldest = [...hurt].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0]
  if (oldest) {
    const days = Math.floor((now.getTime() - new Date(oldest.updatedAt).getTime()) / 86_400_000)
    if (days >= 14) out.push(pickOne(day + oldest.id, `${name(oldest.playerId)} has been on the report for ${days} days. At this point it is a lifestyle.`, `${days} days on the IR for ${name(oldest.playerId)}. Is this an injury or a vacation with extra steps?`))
  }

  const back = board.filter((i) => i.status === "returning")
  if (back.length) out.push(pickOne(day + "back", `${back.map((i) => name(i.playerId)).join(" and ")} ${back.length === 1 ? "is" : "are"} back. Somebody tell the rim.`, `${back.map((i) => name(i.playerId)).join(" and ")} cleared to return. The doctor wants to see the paperwork on that jump shot.`))
  return out.slice(0, 2)
}
