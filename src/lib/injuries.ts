import { pick } from "@/lib/pick"
import { forPlayer } from "@/lib/pronouns"
import { finalSet, isHidden, labelInjuryNotes, LINE_CAP, lineSink } from "@/lib/labels"
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
    "Pulled something opening a pickle jar.",
    "Pulled a hamstring celebrating a basket that did not go in.",
    "Sprained something doing a layup in the mirror.",
    "Pulled a muscle arguing about the last foul call.",
    "Rolled an ankle on flat ground.",
    "Told by a doctor to stop jumping. The rim says thank you.",
    "Mystery injury. Symptoms: pain when the game is on, none when the snacks are out.",
    "Medical advice is to avoid cardio, which was already the plan.",
    "Pulled a muscle trying to dunk on a flamingo float. The flamingo is fine.",
    "Sprained a wrist wringing out the ball after every possession.",
    "Swallowed so much pool arguing a foul call that the doctor says rest.",
    "Got a cramp treading water during a very long timeout.",
    "Tore something doing a layup from the pool steps, which is not a layup.",
    "Lost a fight with a pool noodle. The noodle is undefeated.",
    "Jammed a finger on the rim and blamed the rim, which has not moved.",
    "Pruned so badly the doctor wants to see the fingers on Thursday.",
    "Banged a knee on the ladder, which has been in the same place all summer.",
    "Sunburned the exact outline of the jersey and cannot put anything on.",
    "Got water in the ear and now hears only the other team's trash talk.",
    "Pulled a hamstring swimming to a ball that was already floating to them.",
  ],
  away: [
    "Said they would be back by Friday.",
    "Abducted by a very polite alien who wanted to know about the pick and roll.",
    "Summoned to a hearing about a foul that happened in 2019.",
    "Away, being interviewed by a panel of experts about a single jump shot.",
    "Away after the ball rolled down the street and they are still following it.",
    "Gone to find the person who invented the screen and has some questions.",
    "Detained at the airport for carrying a suspiciously good jump shot.",
    "Currently being studied by scientists who cannot explain the shot.",
  ],
  questionable: [
    "Game-time decision, depending on the snacks.",
    "Will decide when the opponent looks beatable.",
    "Might play, might just complain about it.",
    "Questionable after a gust of wind that had a grudge.",
    "Questionable. Sneezed during warmups and something moved that should not have.",
    "Questionable. Jumped for a rebound in a dream and the knee believes it happened.",
  ],
  dayToDay: [
    "Day-to-day. Sneezed too hard on Tuesday and is still processing.",
    "Day-to-day after a dramatic shrug during a disputed call.",
    "Day-to-day after celebrating a bank shot with too much commitment.",
    "Day-to-day after a pump fake that fooled the pumper.",
    "Day-to-day after a crossover that crossed the wrong person.",
    "Day-to-day after a step-back that went further back than planned.",
    "Day-to-day after a no-look pass to a person who was looking at something else.",
    "Day-to-day after a layup that was too confident for the knees.",
  ],
  returning: [
    "Medically cleared, not sure about the jump shot.",
    "Rested, healthy, and ready to be tired in four minutes.",
    "Back and talking big, which is how it starts every time.",
    "Back after a magical weekend of lying very still.",
    "Back after a miracle recovery that mostly involved ignoring it.",
    "Back after a week of not jumping and calling it strategy.",
    "Back after a week of watching highlights and calling it film study.",
    "Back and cleared, assuming nobody asks them to rebound.",
  ],
}

// A silly note for the status. With a player, their own labels' lines are added to the pool, doubled so they come
// up more often than the generic ones.
export function goofyNote(status: InjuryStatus, avoid?: string, state?: PooleanState, playerId?: string): string {
  const kind = status === "away" ? "away" : status === "returning" ? "back" : "injury"
  const personal = state && playerId ? labelInjuryNotes(state, playerId, kind) : []
  const own = finalSet(GOOFY[status].filter((n) => !isHidden(n)), LINE_CAP.note)
  const pool = [...own, ...personal, ...personal].filter((n) => n !== avoid)
  return forPlayer(playerId ?? null, pool[Math.floor(Math.random() * pool.length)] ?? GOOFY[status][0])
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
  return pick(seed, finalSet(options, LINE_CAP.recap))
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
    if (days >= 14) out.push(pickOne(day + oldest.id, `${name(oldest.playerId)} has been on the injury report for ${days} days. That is a long time to be mentioned this often.`, `${days} days on the report for ${name(oldest.playerId)}. It is starting to feel like a roster spot.`))
  }

  const longTerm = board.filter((i) => i.timeline === "longTerm" && i.status !== "returning")
  if (longTerm.length) {
    const who = longTerm.map((i) => name(i.playerId)).join(" and ")
    const be = longTerm.length === 1 ? "is" : "are"
    out.push(pickOne(day + "long", `Long term for ${who}. Somebody check on them in a month, or whenever it comes up.`, `${who} ${be} out long term, which means the injury is now part of the roster.`, `Long term for ${who}. The couch has been promoted to starter.`, `${who} ${be} out for a while. How long? Nobody knows, including the injured.`, `No return date for ${who}, only a vague sense of next season.`, `${who} ${be} on the long term list, so the weekly check-in text is due.`, `${who} ${be} out long term, so the injury report just got its most reliable name.`))
  }
  const back = board.filter((i) => i.status === "returning")
  if (back.length) out.push(pickOne(day + "back", `${back.map((i) => name(i.playerId)).join(" and ")} ${back.length === 1 ? "is" : "are"} back. Expect rust and a lot of talking.`, `${back.map((i) => name(i.playerId)).join(" and ")} cleared to return. Whether they are in shape is a separate question.`))
  return out.slice(0, 2)
}
