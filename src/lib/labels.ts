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
      cold: ["{n} went {fg}. Gunner gonna gun.", "{fg} for {n}. Somebody took away the green light too late."],
      hot: ["{n} shot {fg} and the gunner defense rests."],
      mvp: ["{n} gunned all night and it worked. Do not tell them."],
      tov: ["{n} turned it over {k} times, mostly while forcing a shot."],
    },
    injury: ["Sprained a shooting wrist from overuse."],
  },
  {
    key: "ballHog",
    name: "Ball Hog",
    blurb: "Passing is a rumor",
    lines: {
      tov: ["{n} gave it away {k} times. Passing is still a rumor.", "{k} turnovers for {n}, all solo."],
      cold: ["{n} hogged it and went {fg}. Share, please."],
      zero: ["{n} scored zero in {g} games with the ball in hand the whole time."],
    },
    injury: ["Strained a thumb from gripping the ball too hard."],
  },
  {
    key: "brickLayer",
    name: "Brick Layer",
    blurb: "Builds houses with the rim",
    lines: {
      cold: ["{n} laid {fg} worth of bricks. The house is nearly done.", "{fg} for {n}. Licensed bricklayer, fully insured."],
      zero: ["{n} scored zero in {g} games. The masonry business is booming."],
      hot: ["{n} shot {fg}. The bricks are finally on strike."],
    },
    injury: ["Back out from carrying too many bricks."],
  },
  {
    key: "cardioVillain",
    name: "Cardio Villain",
    blurb: "Gassed after the second possession",
    lines: {
      cold: ["{n} went {fg} and ran out of gas somewhere around the second possession."],
      noshow: ["{n} skipped the night. Cardio was never the plan anyway."],
      streakL: ["{n} has lost {k} in a row and is winded about it."],
      winless: ["{n} went 0-{l} and needed a nap after each one."],
    },
    injury: ["Winded. Doctors say it is not a medical condition."],
    away: ["Out of town, finding the nearest couch."],
  },
  {
    key: "trashTalker",
    name: "Trash Talker",
    blurb: "All mouth, sometimes backed up",
    lines: {
      winless: ["{n} went 0-{l}. The talking did not translate to the scoreboard.", "0-{l} for {n}. Has been talking about it since."],
      streakL: ["{n} has lost {k} straight and has somehow gotten louder."],
      sweep: ["{n} went {w}-0 and will bring it up until spring."],
      streakW: ["{n} is {k} wins deep and unbearable about it."],
      mvp: ["{n} won MVP and has already started the speech."],
    },
    injury: ["Strained a vocal cord. The silence is the real injury."],
  },
  {
    key: "dunkMachine",
    name: "Dunk Machine",
    blurb: "Lives above the rim",
    lines: {
      hot: ["{n} shot {fg} and threw down like gravity was optional."],
      mvp: ["{n} played above the rim all night. Respectfully, ouch."],
      cold: ["{n} went {fg}. Even the dunk machine needs oil."],
    },
    injury: ["Bruised a hip coming back down."],
  },
  {
    key: "lockdown",
    name: "Lockdown",
    blurb: "Wall at the rim and on the perimeter",
    lines: {
      mvp: ["{n} locked up the night: {pts} points and nobody got by."],
      sweep: ["{n} went {w}-0 and nobody scored on them in peace."],
      streakW: ["{n} has won {k} straight and stopped everyone along the way."],
    },
    injury: ["Hurt a finger swatting a shot too enthusiastically."],
  },
  {
    key: "clutch",
    name: "Clutch",
    blurb: "Wants the last shot",
    lines: {
      mvp: ["{n} took over when it counted and then took the MVP."],
      sweep: ["{n} went {w}-0 and hit every big shot like it was routine."],
      hot: ["{n} shot {fg}. Ice water, as advertised."],
      cold: ["{n} went {fg}. The clutch gene was not clocked in."],
    },
    injury: ["Day-to-day, but available for the last possession."],
  },
  {
    key: "lateArrival",
    name: "Late Arrival",
    blurb: "Fashionably late, or not at all",
    lines: {
      noshow: ["{n} was a no-show. Possibly still looking for parking.", "{n} skipped the night. The text says on my way."],
      streakL: ["{n} has lost {k} in a row, and missed the first game of each."],
      winless: ["{n} went 0-{l}, arriving halfway through every one."],
    },
    away: ["Said they were five minutes out. That was three days ago."],
    back: ["Back, and only slightly late."],
  },
  {
    key: "snackCaptain",
    name: "Snack Captain",
    blurb: "In charge of the cooler",
    lines: {
      noshow: ["{n} skipped the night and the cooler is nervous.", "{n} was a no-show. Nobody has seen the snacks either."],
      tov: ["{n} gave it away {k} times, which is how the chips went too."],
      zero: ["{n} scored zero in {g} games, but the snack game is strong."],
      winless: ["{n} went 0-{l}. The snacks were the only win."],
    },
    injury: ["Strained something reaching for the last chips."],
    back: ["Back with snacks, hopefully."],
  },
  {
    key: "veteranKnees",
    name: "Veteran Knees",
    blurb: "Plays smart because moving fast is gone",
    lines: {
      cold: ["{n} went {fg}. The knees filed a complaint."],
      noshow: ["{n} skipped the night. The knees needed the rest."],
      mvp: ["{n} beat everyone with old man game, and the knees held up."],
      streakW: ["{n} has won {k} straight on guile and Advil."],
    },
    injury: ["Knees made the call. Everyone else will respect it.", "Pulled a muscle getting out of the car."],
    back: ["Knees cleared by the committee."],
  },
  {
    key: "rookie",
    name: "Rookie",
    blurb: "New and still learning where the line is",
    lines: {
      mvp: ["{n} is the rookie and also the MVP. Veterans, take notes."],
      winless: ["{n} went 0-{l}. Welcome to the league, rookie."],
      cold: ["{n} went {fg}. Still learning where the rim is."],
      streakL: ["{n} has lost {k} in a row. Tuition is expensive."],
    },
    injury: ["Rookie mistake: tried a move off the internet."],
    back: ["Back with a new move to try, unfortunately."],
  },
  {
    key: "passingWizard",
    name: "Passing Wizard",
    blurb: "Gets everyone else the bucket",
    lines: {
      mvp: ["{n} threw the night's best passes and took the MVP anyway."],
      zero: ["{n} scored zero in {g} games, on principle, and everyone else ate."],
      sweep: ["{n} went {w}-0 and made everyone else look good."],
    },
    injury: ["Sprained a wrist from too many no-look passes."],
  },
  {
    key: "hustle",
    name: "Hustle Guy",
    blurb: "Dives for everything",
    lines: {
      mvp: ["{n} hustled to the MVP. Somebody get this person a towel."],
      streakL: ["{n} has lost {k} in a row and dove for every loose ball anyway."],
      noshow: ["{n} missed the night. The loose balls are leaderless."],
    },
    injury: ["Scraped a knee diving for a ball that was out of bounds."],
  },
]

// A few labels that are all roast: for the players who have earned it.
LABELS.push(
  {
    key: "excuseMaker",
    name: "Excuse Maker",
    blurb: "It was never the shot, it was the sun",
    lines: {
      cold: ["{n} went {fg}. The sun was in the way, obviously.", "{fg} for {n}, and a full list of reasons ready."],
      winless: ["{n} went 0-{l}, and every loss has a different excuse.", "0-{l} for {n}. The ball was too slippery, the court too flat."],
      streakL: ["{n} has lost {k} in a row and the excuses are getting creative."],
      noshow: ["{n} skipped the night with a very detailed reason. Nobody asked."],
      tov: ["{n} gave it away {k} times. Somebody bumped the ball."],
    },
    injury: ["Injured by the wind, the sun, and everyone else."],
    away: ["Away. The reason is long and nobody asked."],
  },
  {
    key: "matador",
    name: "Matador",
    blurb: "Defense is a polite wave as people go by",
    lines: {
      cold: ["{n} went {fg}, and the defense was just as missing."],
      winless: ["{n} went 0-{l}. Defense was a suggestion, nobody took it."],
      streakL: ["{n} has lost {k} in a row. The defense is a revolving door."],
      sweep: ["{n} went {w}-0, which means the defense finally showed up."],
    },
    injury: ["Pulled a muscle waving at someone driving past."],
  },
  {
    key: "butterfingers",
    name: "Butterfingers",
    blurb: "The ball slides right out",
    lines: {
      tov: ["{n} had {k} turnovers. The ball is basically a bar of soap.", "{k} giveaways for {n}. Try grip tape."],
      cold: ["{n} went {fg}. The ball kept leaving early."],
      zero: ["{n} scored zero in {g} games and fumbled most of the touches."],
    },
    injury: ["Hurt a hand dropping something simple."],
  },
  {
    key: "foulMagnet",
    name: "Foul Magnet",
    blurb: "Every possession ends in a whistle",
    lines: {
      foul: ["{n} collected {k} fouls. Somebody get this person a tab.", "{k} fouls for {n}. The whistle knows the name by now."],
      tov: ["{n} gave it away {k} times and fouled getting it back."],
    },
    injury: ["Bruised from the other players apologizing."],
  },
  {
    key: "soreLoser",
    name: "Sore Loser",
    blurb: "Does not take a loss lightly or quietly",
    lines: {
      winless: ["{n} went 0-{l} and has asked for a rematch in all caps.", "0-{l} for {n}. Expect a long text about it."],
      streakL: ["{n} has lost {k} straight and is writing a formal appeal."],
      cold: ["{n} went {fg} and blamed the rim."],
      noshow: ["{n} skipped the night after the last loss. Healing, allegedly."],
    },
    injury: ["Strained something throwing a ball after the buzzer."],
  },
  {
    key: "fader",
    name: "Late Fader",
    blurb: "Great early, gone when it matters",
    lines: {
      cold: ["{n} went {fg}. Looked great for the first five minutes."],
      streakL: ["{n} has lost {k} in a row, mostly late."],
      winless: ["{n} went 0-{l} with a lead in at least two of them."],
      mvp: ["{n} lasted all night and won MVP. Calendar, mark this."],
    },
    injury: ["Ran out of gas with a lead."],
  },
  {
    key: "warmupLegend",
    name: "Warmup Legend",
    blurb: "Unbeatable until the game starts",
    lines: {
      cold: ["{n} went {fg}. The layup line was better.", "{fg} for {n}, who looked unstoppable in warmups."],
      zero: ["{n} scored zero in {g} games after a perfect warmup."],
      winless: ["{n} went 0-{l}. Won the warmup, though."],
      hot: ["{n} shot {fg} and the warmup finally counted."],
    },
    injury: ["Peaked in warmups and pulled something."],
  },
  {
    key: "flopper",
    name: "Flopper",
    blurb: "Falls down a lot, never at fault",
    lines: {
      foul: ["{n} got called for {k} fouls and acted like it was a drama."],
      tov: ["{n} gave it away {k} times and fell over for sympathy."],
      cold: ["{n} went {fg} and demanded a call on every miss."],
    },
    injury: ["Injured by a gentle breeze. Disputed."],
  },
  {
    key: "tourist",
    name: "Tourist",
    blurb: "Just here for the pictures",
    lines: {
      noshow: ["{n} was a no-show. The tourist season is over.", "{n} skipped the night. Apparently the sightseeing was elsewhere."],
      zero: ["{n} scored zero in {g} games. Mostly there for the view."],
      winless: ["{n} went 0-{l}. Great photos, though."],
    },
    away: ["Out sightseeing."],
  },
)

export const labelDef = (key: string) => LABELS.find((l) => l.key === key)
// What the label is called: a library name, or the custom text as typed.
export const labelName = (key: string) => labelDef(key)?.name ?? key

// For labels typed in by hand, lines that work with any label.
const GENERIC: Record<LabelEvent, string[]> = {
  hot: ["{n} the {label} shot {fg}, and the label held up."],
  cold: ["{n}, certified {label}, went {fg}."],
  tov: ["{n} the {label} gave it away {k} times."],
  zero: ["{n} the {label} scored zero in {g} games."],
  noshow: ["{n} the {label} skipped the night. On brand."],
  mvp: ["{n}, our {label}, ran the night."],
  sweep: ["{n} the {label} swept the night, {w}-0."],
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
