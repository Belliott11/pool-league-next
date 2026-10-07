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
    "Pulled a muscle yawning in the middle of a high five.",
    "Sprained a thumb winning an argument with a vending machine.",
    "Strained an eyebrow reading the rules.",
    "Fell off a chair that was already on the floor.",
    "Dislocated a shoulder patting themselves on the back.",
    "Hurt a knee kneeling to tie a shoe that was velcro.",
    "Tore something stretching for a stretch.",
    "Rolled an ankle on a ball that was not on the court.",
    "Pulled a hamstring thinking about running.",
    "Got whiplash looking back at a bad shot from last month.",
    "Hurt a finger pointing at the scoreboard too hard.",
    "Lost a collision with a doorframe that had the right of way.",
    "Allergic to gravity. Symptoms occur on landing.",
  ],
  away: [
    "Said they would be back by Friday.",
    "Abducted by a very polite alien who wanted to know about the pick and roll.",
    "Taken in by a family of squirrels who have no interest in the game.",
    "Away, serving as a witness in a trial between two ducks.",
    "Stuck behind a very slow herd of goats on the only road.",
    "Called away to referee a staring contest that is now on day nine.",
    "Stuck in a revolving door, going on day four, in good spirits.",
    "Hired by a lighthouse. The lighthouse has questions.",
    "Away at a conference to discuss the pick and roll with several helpful wizards.",
    "Challenged a trampoline to a duel and has not returned from the rematch.",
    "Left to find a better basketball and has not yet found a worse person to ask.",
    "On a diplomatic mission to settle a dispute between two ice cream trucks.",
    "Away teaching a goose to dribble. The goose is winning.",
    "Called to a very urgent meeting with their own reflection.",
    "Away, recovering from a fortune cookie that gave very specific, very bad advice.",
    "Went to catch a bus and the bus is, so far, winning.",
    "Stuck in a dream where the court gets slightly farther away every time.",
    "Away, helping a turtle across the road, which is taking all week.",
    "Abducted by a different alien who only wanted to talk about zone defense.",
  ],
  questionable: [
    "Game-time decision, depending on the snacks.",
    "Will decide when the opponent looks beatable.",
    "Might play, might just complain about it.",
    "Questionable after a gust of wind that had a grudge.",
    "Questionable. Sneezed during warmups and something moved that should not have.",
    "Questionable. Yawned wrong during warmups and something clicked that should not click.",
    "Questionable after a dramatic weather event that was only one cloud.",
    "Questionable after a high five landed slightly off center and the hand is still deciding.",
    "Questionable. Laughed at a joke during stretching and the back has opinions.",
    "Questionable after a draft from an open door with a personal vendetta.",
    "Questionable after being hit by a ball that was not even thrown at them.",
    "Questionable. Looked at the sun one second too long and now only sees layups.",
    "Questionable after a hiccup landed funny.",
    "Questionable, since the water bottle turned out to be heavier than expected.",
    "Questionable after blinking too hard.",
  ],
  dayToDay: [
    "Day-to-day. Sneezed too hard on Tuesday and is still processing.",
    "Day-to-day. Coughed on Wednesday and the ribs filed a complaint.",
    "Day-to-day after a laugh that went longer than recommended.",
    "Day-to-day. Reached for something on a high shelf in March and it is still a topic.",
    "Day-to-day after clapping too enthusiastically on Friday.",
    "Day-to-day, because a stair was one taller than expected.",
    "Day-to-day after turning around too quickly, a skill nobody trained for.",
    "Day-to-day. Slept in a position that has been described as ambitious.",
    "Day-to-day after a heated disagreement with a car door.",
    "Day-to-day. Stepped off a curb that was not there yesterday.",
    "Day-to-day. Got excited at a movie and something in the neck remembers.",
    "Day-to-day after bending down for a coin that turned out to be a sticker.",
    "Day-to-day. Waved too hard at a stranger on Monday.",
    "Day-to-day. Pushed a door labeled pull, and the door won.",
  ],
  returning: [
    "Medically cleared, not sure about the jump shot.",
    "Rested, healthy, and ready to be tired in four minutes.",
    "Back and talking big, which is how it starts every time.",
    "Back after a magical weekend of lying very still.",
    "Back after a weekend of staring at the ceiling and calling it physical therapy.",
    "Back after three days of being very careful with a banana.",
    "Cleared by a team of toddlers who watched them walk.",
    "Back after a long weekend of sitting like an elderly king.",
    "Back. Recovered by doing nothing with great confidence.",
    "Back after being blessed by a group of strangers on a park bench.",
    "Back after a week of walking only in straight lines.",
    "Back after a deep and meaningful talk with a heating pad.",
    "Returned after being declared healthy by three people who are not doctors.",
    "Back after a week of very quietly not jumping.",
    "Back after a nap that lasted exactly as long as the injury.",
    "Back, healed, and still not sure which leg was the problem.",
    "Back after an intense program of lying on the floor and looking up.",
    "Back with a note that says everything is fine in handwriting that does not look like a doctor's.",
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
