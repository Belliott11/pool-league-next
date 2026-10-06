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
    "Out. Get well soon, or at least before the next game.",
    "Out, so everyone else's stats are about to look better.",
    "Out, and the group has already started dividing up the shots.",
    "Out. The injury report has the details and the details are none of your business.",
    "Out, which leaves one fewer person to blame for the loss.",
    "Out. The rest of the group is being very brave about it.",
    "Out, and the other players are suddenly very healthy.",
    "Out, and the group chat has promised to be supportive and will not be.",
    "Out for now, and still has opinions about how the game is going.",
    "Out, which means the teams just got easier to pick.",
    "Out. Whoever replaces them has a lot of room to look good.",
    "Out. Everyone else's rebounds are about to look better.",
  ],
  away: [
    "Said they would be back by Friday.",
    "Away. The group has been told nothing and is not making anything up, out of respect.",
    "Away, so the court feels emptier and the group chat feels louder.",
    "Away for now. The score will be read to them, slowly.",
    "Not here. The group will report on what they missed, which will be nothing.",
    "Away, so the average skill level just changed, and nobody will say which way.",
    "Away. The group is accepting condolences for the empty spot.",
    "Away. They will be told what they missed, and the story will improve with every retelling.",
    "Away, and the group has agreed to say nice things about them until they are back.",
    "Away. Whoever takes the open spot has no one to be compared to.",
  ],
  questionable: [
    "Game-time decision, depending on the snacks.",
    "Will decide when the opponent looks beatable.",
    "Might play, might just complain about it.",
    "Questionable. The group will find out when they show up, or when they do not.",
    "Questionable, which is a polite way of saying nobody knows, including them.",
    "Listed as questionable, so plan for either and be disappointed by one.",
    "Questionable. A coin has been consulted and declined to comment.",
    "Questionable, and the decision will be made at the last possible moment.",
    "Questionable. Half the group is hoping yes and the other half is hoping yes for the other team.",
  ],
  dayToDay: [
    "Day-to-day. Check back tomorrow, and the day after.",
    "Day-to-day, which is medical for we will see.",
    "Day-to-day, and every day is a new decision.",
    "Day-to-day. The report will be updated when there is something to say, which is not today.",
    "Day-to-day, so the group is advised to ask how it feels every ten minutes, not every five.",
    "Day-to-day. Good days and bad days expected, in unknown order.",
    "Day-to-day, and the group is rooting for the good days.",
  ],
  returning: [
    "Medically cleared, not sure about the jump shot.",
    "Rested, healthy, and ready to be tired in four minutes.",
    "Back and talking big, which is how it starts every time.",
    "Back. The group will find out in about four minutes how much rust there is.",
    "Back, and will explain at some point why the first few misses do not count.",
    "Back, and everyone is hoping it is the good version.",
    "Back. The injury report is lighter by one name and the court is heavier by one opinion.",
    "Returning, which means someone has to share the ball again.",
    "Back in the lineup, and the stat sheet is nervous.",
    "Back. Expect some rust and a lot of commentary on the rust.",
    "Back, so the group will see whether the break helped or whether it was just a break.",
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
    out.push(pickOne(day + "long", `Long term for ${who}. Somebody check on them in a month, or whenever it comes up.`, `${who} ${be} out long term, which means the injury is now part of the roster.`, `${who} ${be} out for a while. How long? Nobody knows, including the injured.`, `No return date for ${who}, only a vague sense of next season.`, `${who} ${be} on the long term list, so the weekly check-in text is due.`, `${who} ${be} out long term, so the injury report just got its most reliable name.`))
  }
  const back = board.filter((i) => i.status === "returning")
  if (back.length) out.push(pickOne(day + "back", `${back.map((i) => name(i.playerId)).join(" and ")} ${back.length === 1 ? "is" : "are"} back. Expect rust and a lot of talking.`, `${back.map((i) => name(i.playerId)).join(" and ")} cleared to return. Whether they are in shape is a separate question.`))
  return out.slice(0, 2)
}
