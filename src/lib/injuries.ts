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
    "Pulled something opening a pickle jar.",
    "Pulled a hamstring celebrating a basket that did not go in.",
    "Sprained something doing a layup in the mirror.",
    "Pulled a muscle arguing about the last foul call.",
    "Rolled an ankle on flat ground.",
    "Rolled an ankle on the way to the snack table, the most athletic move of the month.",
    "Went down reaching for the last slice and got up still holding the slice.",
    "Back is out. The couch is giving daily updates.",
    "Threw out a back bending to tie a shoe. The shoe is fine.",
    "Stubbed a toe on the coffee table and has limped with commitment ever since.",
    "A toe has been stubbed. Please be gentle with the person it is attached to.",
    "Lost a fight with a puddle. The puddle did not even notice.",
    "Slipped on pool water, in the one place everyone said to walk carefully.",
    "Doctor says no jumping, which is a relief for everyone who has seen the jump.",
    "Told by a doctor to stop jumping. The rim says thank you.",
    "Out with an injury nobody can find. Several people have looked, including the injured.",
    "Mystery injury. Symptoms: pain when the game is on, none when the snacks are out.",
    "Cleared for nothing: no running, no jumping, no contested layups, and plenty of time to talk about it.",
    "Medical advice is to avoid cardio, which was already the plan.",
  ],
  away: [
    "Said they would be back by Friday.",
    "Out of town on a boat. Nobody has seen the boat, only the pictures.",
    "Somewhere on a boat, posting pictures with the caption no phone service.",
    "On vacation and sending photos to people who are working.",
    "Gone on vacation. The tan lines will be explained at the next game.",
    "Away for work, according to a person who also said that last time.",
    "Working, the group has been told. The group is not convinced.",
    "Visiting family and being fed on a schedule. Expect them to return slower.",
    "Back soon, after a lot of family food. Cardio will be a surprise.",
    "Off the grid near a lake. Last seen holding a fishing rod and no basketball.",
    "Gone dark at a lake. The group chat has sent three search parties and zero texts.",
    "At a wedding, dancing better than they play.",
    "Away at a wedding, and the open bar is doing better than the team.",
    "Unreachable. Read receipts say seen, the replies say no.",
    "Has not answered a text in days and is clearly alive on social media.",
    "Traveling somewhere without a hoop and having a nice time, which is a bold choice.",
    "On a trip to a place with no basketball, which is the opposite of a reason to leave.",
    "Helping someone move, which means standing near a couch and pointing.",
    "Stuck helping a friend move a couch. The couch is winning.",
  ],
  questionable: [
    "Game-time decision, depending on the snacks.",
    "Will decide when the opponent looks beatable.",
    "Might play, might just complain about it.",
    "Insists it is fine, then limped to the cooler like a movie.",
    "Says there is no injury and has now sat down four times in ten minutes.",
    "Warmups were stretching and a long talk about the knee.",
    "Did the whole warmup sitting down, so we will see.",
    "Questionable according to a source who just wants to lose less.",
    "Listed as questionable by a person who needs the other team to be easier.",
    "Said it is nothing, then asked everyone to bring a chair.",
    "Claims to feel great and has not stood up since arriving.",
    "Playing through a hangnail and wants applause.",
    "Questionable with a hangnail, a sore feeling, and a lot of attention.",
  ],
  dayToDay: [
    "Sore from last week, which was one game, and everyone has been told.",
    "Still feeling last week in the legs. It was not that kind of week.",
    "The legs want to play. The knees have a vote and it is not a yes.",
    "Legs are in, knees are out, and the knees get final say.",
    "Landed badly, got up slowly, and has been dramatic since.",
    "Taking it easy after a landing that has now been described many times.",
    "Moving like it is 2005, still talking like it is the finals.",
    "Slow on the court, fast on the excuses.",
    "Tweaked something in a meeting. Sitting is dangerous.",
    "Stiff after a long meeting, so technically a desk injury.",
    "Tweaked something and refuses to say what, which means it is embarrassing.",
    "A tweak of unknown origin and a firm refusal to explain.",
    "Day-to-day, and the day is not today.",
    "Day-to-day, and this day is a no, the next one is a maybe.",
    "Walking it off at a pace that suggests a lot is being walked.",
    "Trying to walk it off. It has not left.",
  ],
  returning: [
    "Medically cleared, not sure about the jump shot.",
    "Back in practice and looking good in the driveway, where nobody keeps score.",
    "Practiced all week alone and looks great, which is easy with no defender.",
    "Cleared to play, and the rest of the league got no warning.",
    "Doctor says yes. The group would like a second opinion.",
    "Fresh legs after the time off, and no idea what the rest of us have been doing.",
    "Rested, healthy, and ready to be tired in four minutes.",
    "Ready to go with a rust level somewhere between old gate and old bike.",
    "Back after a long break. Rust level is a surprise for everyone.",
    "Back and talking big, which is how it starts every time.",
    "Back with a speech prepared. The game is optional.",
    "Back after a long rest and a heroic number of snacks. Cardio is a theory.",
    "Back from the injury list with something to prove, and several people ready to test it.",
    "Back with a point to make and a knee to do it with.",
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
  if (longTerm.length) {
    const who = longTerm.map((i) => name(i.playerId)).join(" and ")
    const be = longTerm.length === 1 ? "is" : "are"
    out.push(pickOne(day + "long", `Long term for ${who}. Somebody check on them in a month, or whenever it comes up.`, `${who} ${be} out long term. The group chat has already stopped asking.`, `Nobody has a return date for ${who}, and nobody has asked for one.`, `${who} ${be} on the long term list. Send a card, or a meme.`))
  }
  const back = board.filter((i) => i.status === "returning")
  if (back.length) out.push(pickOne(day + "back", `${back.map((i) => name(i.playerId)).join(" and ")} ${back.length === 1 ? "is" : "are"} back. Expect rust and a lot of talking.`, `${back.map((i) => name(i.playerId)).join(" and ")} cleared to return. Whether they are in shape is a separate question.`))
  return out.slice(0, 2)
}
