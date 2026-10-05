import type { PooleanState } from "@/lib/types"

// Labels for personalizing the headlines: assign a few to each player on the Players tab and the recap and injury
// report write lines about them. {n} is the name; the other {x} slots are filled from the story (fg, k, w, l, g, pts).
export type LabelEvent = "hot" | "cold" | "tov" | "zero" | "noshow" | "mvp" | "sweep" | "winless" | "streakW" | "streakL" | "foul"

export interface LabelDef {
  key: string
  name: string
  blurb: string
  lines: Partial<Record<LabelEvent, string[]>>
  injury?: string[] // notes for the injury report when out, questionable or day to day
  away?: string[]
  back?: string[]
}

export const LABELS: LabelDef[] = [
  {
    key: "gunner",
    name: "Gunner",
    blurb: "Shoots first and asks no questions",
    lines: {
      cold: ["{n} went {fg}. Still shooting every time, as usual.", "{fg} for {n}. The gunner label has not gone anywhere."],
      hot: ["{n} shot {fg}. Fine, the shots were worth taking tonight."],
      mvp: ["{n} shot a lot and it worked out. MVP of the night."],
      tov: ["{n} turned it over {k} times, mostly forcing shots."],
    },
    injury: ["Sore shooting wrist from overuse."],
  },
  {
    key: "ballHog",
    name: "Ball Hog",
    blurb: "Passing is a rumor",
    lines: {
      tov: ["{n} had {k} turnovers. Not a lot of passing in there.", "{k} turnovers for {n}, almost all of them solo."],
      cold: ["{n} kept the ball and went {fg}. A pass might have helped."],
      zero: ["{n} had the ball a lot and still scored zero in {g} games."],
    },
    injury: ["Sore thumb from holding the ball too tight."],
  },
  {
    key: "brickLayer",
    name: "Brick Layer",
    blurb: "Lots of misses off the rim",
    lines: {
      cold: ["{n} went {fg}. A lot of bricks tonight.", "{fg} for {n}. Another night off the rim."],
      zero: ["{n} scored zero in {g} games. Every shot was a brick."],
      hot: ["{n} shot {fg}. The bricks stopped for a night."],
    },
    injury: ["Sore back from carrying all those bricks."],
  },
  {
    key: "cardioVillain",
    name: "Cardio Villain",
    blurb: "Gassed after the second possession",
    lines: {
      cold: ["{n} went {fg} and looked tired most of the night."],
      noshow: ["{n} skipped the night. No cardio, no problem."],
      streakL: ["{n} has lost {k} in a row, and the late-game legs are not helping."],
      winless: ["{n} went 0-{l}, and looked tired by the end of each one."],
    },
    injury: ["Winded. Doctors say it is not a medical condition."],
    away: ["Out of town, and probably resting."],
  },
  {
    key: "trashTalker",
    name: "Trash Talker",
    blurb: "All mouth, sometimes backed up",
    lines: {
      winless: ["{n} went 0-{l} after all that talking.", "0-{l} for {n}. The talking did not help on the scoreboard."],
      streakL: ["{n} has lost {k} in a row and is somehow still talking."],
      sweep: ["{n} went {w}-0, so expect to hear about it all week."],
      streakW: ["{n} has won {k} straight, and the trash talk has gone up with it."],
      mvp: ["{n} won MVP, so the talking was backed up this time."],
    },
    injury: ["Lost their voice. The quiet is the real injury."],
  },
  {
    key: "dunkMachine",
    name: "Dunk Machine",
    blurb: "Lives above the rim",
    lines: {
      hot: ["{n} shot {fg} and got up over everyone."],
      mvp: ["{n} played above the rim all night and took MVP."],
      cold: ["{n} went {fg}. Not much going down tonight, dunks included."],
    },
    injury: ["Bruised hip after a hard landing."],
  },
  {
    key: "lockdown",
    name: "Lockdown",
    blurb: "Wall at the rim and on the perimeter",
    lines: {
      mvp: ["{n} locked people up all night and scored {pts} too. MVP."],
      sweep: ["{n} went {w}-0, and nobody scored easily on them."],
      streakW: ["{n} has won {k} straight, mostly on defense."],
    },
    injury: ["Jammed a finger on a block."],
  },
  {
    key: "clutch",
    name: "Clutch",
    blurb: "Wants the last shot",
    lines: {
      mvp: ["{n} came through when it mattered and took MVP."],
      sweep: ["{n} went {w}-0 and hit the big shots all night."],
      hot: ["{n} shot {fg}. Calm under pressure, as usual."],
      cold: ["{n} went {fg}. Not much clutch tonight."],
    },
    injury: ["Day-to-day, but will be there for the last possession."],
  },
  {
    key: "lateArrival",
    name: "Late Arrival",
    blurb: "Fashionably late, or not at all",
    lines: {
      noshow: ["{n} did not show up. Maybe still on the way.", "{n} missed the night. Expect a text saying on my way."],
      streakL: ["{n} has lost {k} in a row, and keeps missing the first game."],
      winless: ["{n} went 0-{l}, arriving late for most of it."],
    },
    away: ["Said they were five minutes out. That was days ago."],
    back: ["Back, and only a little late."],
  },
  {
    key: "snackCaptain",
    name: "Snack Captain",
    blurb: "In charge of the cooler",
    lines: {
      noshow: ["{n} skipped the night, so nobody knows where the snacks are.", "{n} was not there tonight, and neither were the snacks."],
      tov: ["{n} gave it away {k} times, about as often as the chips went around."],
      zero: ["{n} scored zero in {g} games, but the snacks were good."],
      winless: ["{n} went 0-{l}. The snacks were the only win."],
    },
    injury: ["Strained something reaching for the last chips."],
    back: ["Back, and hopefully with snacks."],
  },
  {
    key: "veteranKnees",
    name: "Veteran Knees",
    blurb: "Plays smart because moving fast is gone",
    lines: {
      cold: ["{n} went {fg}. The knees were not cooperating."],
      noshow: ["{n} skipped the night to rest the knees."],
      mvp: ["{n} won MVP on pure experience, and the knees held up."],
      streakW: ["{n} has won {k} straight on smart play, not speed."],
    },
    injury: ["The knees made the call.", "Pulled a muscle getting out of the car."],
    back: ["Knees cleared to play."],
  },
  {
    key: "rookie",
    name: "Rookie",
    blurb: "New and still learning where the line is",
    lines: {
      mvp: ["{n} is the rookie and the MVP of the night."],
      winless: ["{n} went 0-{l}. Welcome to the league."],
      cold: ["{n} went {fg}. Still learning the court."],
      streakL: ["{n} has lost {k} in a row. Part of learning the league."],
    },
    injury: ["Hurt trying a move seen online."],
    back: ["Back, with a new move to try."],
  },
  {
    key: "passingWizard",
    name: "Passing Wizard",
    blurb: "Gets everyone else the bucket",
    lines: {
      mvp: ["{n} set up everyone else and took MVP anyway."],
      zero: ["{n} scored zero in {g} games, passing the ball to everyone else."],
      sweep: ["{n} went {w}-0, and made everyone else better."],
    },
    injury: ["Sore wrist from too many no-look passes."],
  },
  {
    key: "hustle",
    name: "Hustle Guy",
    blurb: "Dives for everything",
    lines: {
      mvp: ["{n} hustled their way to MVP."],
      streakL: ["{n} has lost {k} in a row, and still dove for every loose ball."],
      noshow: ["{n} missed the night, so nobody dove for loose balls."],
    },
    injury: ["Scraped knee from diving for a ball that was out of bounds."],
  },
]

// A few labels that are all roast: for the players who have earned it.
LABELS.push(
  {
    key: "excuseMaker",
    name: "Excuse Maker",
    blurb: "It was never the shot, it was the sun",
    lines: {
      cold: ["{n} went {fg}. Expect an excuse about the sun.", "{fg} for {n}, with a list of reasons ready."],
      winless: ["{n} went 0-{l}, with a different excuse for each loss.", "0-{l} for {n}. The ball was too slippery, the court too flat."],
      streakL: ["{n} has lost {k} in a row, and the excuses keep coming."],
      noshow: ["{n} skipped the night and sent a long reason. Nobody asked."],
      tov: ["{n} had {k} turnovers. Somebody bumped them, apparently."],
    },
    injury: ["Hurt by the wind, the sun, and everyone else."],
    away: ["Away. The reason is long and nobody asked."],
  },
  {
    key: "matador",
    name: "Matador",
    blurb: "Defense is a polite wave as people go by",
    lines: {
      cold: ["{n} went {fg}, and the defense was not much better."],
      winless: ["{n} went 0-{l}. Not much defense in any of them."],
      streakL: ["{n} has lost {k} in a row, and the defense has not stopped anyone."],
      sweep: ["{n} went {w}-0, so the defense actually showed up."],
    },
    injury: ["Pulled a muscle waving at someone driving past."],
  },
  {
    key: "butterfingers",
    name: "Butterfingers",
    blurb: "The ball slides right out",
    lines: {
      tov: ["{n} had {k} turnovers. The ball kept slipping.", "{k} turnovers for {n}. Maybe try grip tape."],
      cold: ["{n} went {fg}. The ball kept slipping out early."],
      zero: ["{n} scored zero in {g} games and dropped a lot of passes."],
    },
    injury: ["Hurt a hand dropping something simple."],
  },
  {
    key: "foulMagnet",
    name: "Foul Magnet",
    blurb: "Every possession ends in a whistle",
    lines: {
      foul: ["{n} was called for {k} fouls. That is a lot of whistles.", "{k} fouls for {n}. Same as every week."],
      tov: ["{n} had {k} turnovers and fouled trying to get the ball back."],
    },
    injury: ["Bruised from everyone else's apologies."],
  },
  {
    key: "soreLoser",
    name: "Sore Loser",
    blurb: "Does not take a loss lightly or quietly",
    lines: {
      winless: ["{n} went 0-{l} and has already asked for a rematch.", "0-{l} for {n}. Expect a long text about it."],
      streakL: ["{n} has lost {k} straight and is not happy about it."],
      cold: ["{n} went {fg} and blamed the rim."],
      noshow: ["{n} skipped the night after the last loss."],
    },
    injury: ["Strained something throwing a ball after the buzzer."],
  },
  {
    key: "fader",
    name: "Late Fader",
    blurb: "Great early, gone when it matters",
    lines: {
      cold: ["{n} went {fg}. Good start, then it faded."],
      streakL: ["{n} has lost {k} in a row, mostly late in the games."],
      winless: ["{n} went 0-{l}, with a lead in at least a couple of them."],
      mvp: ["{n} held up all night and won MVP. Rare for them."],
    },
    injury: ["Ran out of gas with a lead."],
  },
  {
    key: "warmupLegend",
    name: "Warmup Legend",
    blurb: "Unbeatable until the game starts",
    lines: {
      cold: ["{n} went {fg}. Looked a lot better in warmups.", "{fg} for {n}, who was great in warmups."],
      zero: ["{n} scored zero in {g} games after a perfect warmup."],
      winless: ["{n} went 0-{l}. At least the warmup went well."],
      hot: ["{n} shot {fg}. The warmup form carried over this time."],
    },
    injury: ["Peaked in warmups and pulled something."],
  },
  {
    key: "flopper",
    name: "Flopper",
    blurb: "Falls down a lot, never at fault",
    lines: {
      foul: ["{n} was called for {k} fouls and argued about every one."],
      tov: ["{n} had {k} turnovers and went down looking for a call on a few."],
      cold: ["{n} went {fg} and wanted a call on every miss."],
    },
    injury: ["Hurt by a light breeze. Disputed."],
  },
  {
    key: "tourist",
    name: "Tourist",
    blurb: "Just here for the pictures",
    lines: {
      noshow: ["{n} was not there tonight. Probably sightseeing somewhere.", "{n} skipped the night."],
      zero: ["{n} scored zero in {g} games. More there for the view."],
      winless: ["{n} went 0-{l}. At least the photos were good."],
    },
    away: ["Out sightseeing."],
  },
)

export const labelDef = (key: string) => LABELS.find((l) => l.key === key)
// What the label is called: a library name, or the custom text as typed.
export const labelName = (key: string) => labelDef(key)?.name ?? key

// For labels typed in by hand, lines that work with any label.
const GENERIC: Record<LabelEvent, string[]> = {
  hot: ["{n} the {label} shot {fg}."],
  cold: ["{n} the {label} went {fg}."],
  tov: ["{n} the {label} gave it away {k} times."],
  zero: ["{n} the {label} scored zero in {g} games."],
  noshow: ["{n} the {label} skipped the night."],
  mvp: ["{n} the {label} was the MVP of the night."],
  sweep: ["{n} the {label} went {w}-0 on the night."],
  winless: ["{n} the {label} went 0-{l}."],
  streakW: ["{n} the {label} has won {k} straight."],
  streakL: ["{n} the {label} has lost {k} in a row."],
  foul: ["{n} the {label} picked up {k} fouls."],
}

export function labelsOf(state: PooleanState, playerId: string): string[] {
  return ((state.playerLabels ?? {}) as Record<string, string[]>)[playerId] ?? []
}

const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

function hash(seed: string): number {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

// A headline from the player's own labels for this kind of moment, or null when they have none that fit.
export function labelLine(state: PooleanState, playerId: string, event: LabelEvent, vars: Record<string, string | number>, seed: string): string | null {
  const keys = labelsOf(state, playerId)
  if (keys.length === 0) return null
  const lines: string[] = []
  for (const k of keys) {
    const def = labelDef(k)
    if (def) lines.push(...(def.lines[event] ?? []))
    else lines.push(...GENERIC[event].map((t) => t.split("{label}").join(k.toLowerCase())))
  }
  if (lines.length === 0) return null
  return fill(lines[hash(seed + playerId + event) % lines.length], vars)
}

// Injury report notes drawn from a player's labels, for the dice button.
export function labelInjuryNotes(state: PooleanState, playerId: string, kind: "injury" | "away" | "back"): string[] {
  return labelsOf(state, playerId).flatMap((k) => labelDef(k)?.[kind] ?? [])
}
