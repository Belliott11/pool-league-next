import { pick } from "@/lib/pick"
import { labelInjuryNotes, lineSink } from "@/lib/labels"
import type { Injury, InjuryStatus, PooleanState } from "@/lib/types"

export const TIMELINES: { key: NonNullable<Injury["timeline"]>; label: string }[] = [
  { key: "dayToDay", label: "Day to day" },
  { key: "weeks", label: "1-2 weeks" },
  { key: "longTerm", label: "Long term" },
]
export const timelineLabel = (t: Injury["timeline"] | undefined) => TIMELINES.find((x) => x.key === t)?.label ?? ""

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
export const GOOFY: Record<InjuryStatus, string[]> = {
  out: [
    "Rolled an ankle reaching for the last slice.",
    "Pulled something opening a pickle jar.",
    "Bad back. Resting on the couch.",
    "Stubbed a toe and is making the most of it.",
    "Pulled a hamstring celebrating a basket that did not go in.",
    "Sprained something doing a layup in the mirror.",
    "Pulled a muscle arguing about the last foul call.",
    "Slipped on a puddle by the pool.",
    "Doctor says no jumping.",
    "Out with a mystery injury.",
    "Rolled an ankle on flat ground.",
    "Doctor's orders: no cardio and no contested layups.",
  ],
  away: [
    "Out of town, probably on a boat.",
    "On vacation. Tan lines pending.",
    "Working, allegedly.",
    "Visiting family and eating well. Back soon.",
    "Off the grid. Last seen near a lake.",
    "At a wedding. Dancing, not shooting.",
    "Unreachable. Texts on read.",
    "Said they would be back by Friday.",
    "On a trip somewhere with no hoops.",
    "Helping someone move. Back when the couch is placed.",
  ],
  questionable: [
    "Says it is fine, but is limping to the cooler.",
    "Warmups were mostly stretching.",
    "Listed as questionable by a very biased source.",
    "Game-time decision, depending on the snacks.",
    "Swears it is nothing, then asked for a chair.",
    "Playing through it. It is a hangnail.",
    "Will decide when the opponent looks beatable.",
    "Might play, might just complain about it.",
  ],
  dayToDay: [
    "Sore from last week.",
    "Legs say yes, knees say no.",
    "Taking it easy after a rough landing.",
    "Moving slowly, talking fast.",
    "Stiff after a long meeting. A real sports injury.",
    "Tweaked something and will not say what.",
    "Day-to-day, and today looks like a no.",
    "Walking it off, slowly.",
  ],
  returning: [
    "Back in full practice and looking sharp in the driveway.",
    "Cleared to play and feeling good.",
    "Fresh legs after the time off.",
    "Ready to go. Rust level unknown.",
    "Back and talking big.",
    "Back after a long rest and a lot of snacks.",
    "Medically cleared, not sure about the jump shot.",
    "Back from the injury list with something to prove.",
  ],
}

// A silly note for the status. With a player, their own labels' lines are added to the pool, doubled so they come
// up more often than the generic ones.
export function goofyNote(status: InjuryStatus, avoid?: string, state?: PooleanState, playerId?: string): string {
  const kind = status === "away" ? "away" : status === "returning" ? "back" : "injury"
  const personal = state && playerId ? labelInjuryNotes(state, playerId, kind) : []
  const pool = [...GOOFY[status], ...personal, ...personal].filter((n) => n !== avoid)
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
const pickOne = (seed: string, ...options: string[]): string => {
  lineSink.current?.(options)
  return pick(seed, options)
}

export function injuryHeadlines(state: PooleanState, name: (id: string) => string, now = new Date()): string[] {
  const board = injuryBoard(state)
  const day = now.toISOString().slice(0, 10)
  const out: string[] = []
  const hurt = board.filter((i) => i.status !== "returning")
  // A long-term case gets its own line below, so it is left out of the plain "is out" headline.
  const outNow = board.filter((i) => i.status === "out" && i.timeline !== "longTerm")
  const roster = Math.max(state.players.length, 1)

  if (board.length === 0) return [pickOne(day, "Everyone is healthy right now. Suspicious, honestly.", "No injuries on the report. Somebody is not playing hard enough.", "A clean bill of health across the league. Nobody is trying anything new.")]

  if (hurt.length >= Math.max(3, roster / 3)) {
    out.push(pickOne(day + "many", `${hurt.length} players are hurt or away. The report is longer than the bench.`, `${hurt.length} players on the report. Maybe stretch before games.`, `A third of the league is on the report. That is not a warmup problem, that is a pattern.`))
  } else if (outNow.length === 1) {
    out.push(pickOne(day + "one", `${name(outNow[0].playerId)} is out. Their team gets a new excuse for losing.`, `${name(outNow[0].playerId)} is out. Get well soon, or at least before the next game.`))
  } else if (outNow.length >= 2) {
    out.push(pickOne(day + "two", `${outNow.map((i) => name(i.playerId)).join(" and ")} are both out. Games will be short on talent and long on excuses.`, `${outNow.length} players are out. Teams get thinner and the excuses get better.`))
  }

  // The longest-running case.
  const oldest = [...hurt].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0]
  if (oldest) {
    const days = Math.floor((now.getTime() - new Date(oldest.updatedAt).getTime()) / 86_400_000)
    if (days >= 14) out.push(pickOne(day + oldest.id, `${name(oldest.playerId)} has been on the report for ${days} days. At this point it is a vacation.`, `${days} days on the injury report for ${name(oldest.playerId)}. Doctors have not been consulted, and the couch is winning.`))
  }

  const longTerm = board.filter((i) => i.timeline === "longTerm" && i.status !== "returning")
  if (longTerm.length) out.push(pickOne(day + "long", `${longTerm.map((i) => name(i.playerId)).join(" and ")} ${longTerm.length === 1 ? "is" : "are"} out long term. Do not expect a return soon, or a text back.`, `Long term injury for ${longTerm.map((i) => name(i.playerId)).join(" and ")}. Nobody is sure when they are back.`))
  const back = board.filter((i) => i.status === "returning")
  if (back.length) out.push(pickOne(day + "back", `${back.map((i) => name(i.playerId)).join(" and ")} ${back.length === 1 ? "is" : "are"} back. Expect rust and a lot of talking.`, `${back.map((i) => name(i.playerId)).join(" and ")} cleared to return. Whether they are in shape is a separate question.`))
  return out.slice(0, 2)
}
