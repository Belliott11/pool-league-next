import { pick } from "@/lib/pick"
import type { PooleanState } from "@/lib/types"

// Labels for personalizing the headlines: assign a few to each player on the Players tab and the recap and injury
// report write lines about them. {n} is the name; the other {x} slots are filled from the story (fg, k, w, l, g, pts).
export type LabelEvent = "hot" | "cold" | "tov" | "zero" | "noshow" | "mvp" | "sweep" | "winless" | "streakW" | "streakL" | "foul" | "up" | "down" | "revenge" | "owned"

export interface LabelDef {
  key: string
  name: string
  blurb: string
  lines: Partial<Record<LabelEvent, string[]>>
  injury?: string[] // notes for the injury report when out, questionable or day to day
  away?: string[]
  back?: string[]
}

// Labels you can give a player, each with the headline wording for the moments it fits. The first ones are
// character types; the roast labels (Excuse Maker onward) are for the players who have earned it.
// Labels you can give a player, each with the headline wording for the moments it fits. The first ones are
// character types; the roast labels (Excuse Maker onward) are for the players who have earned it.
// Labels you can give a player, each with the headline wording for the moments it fits. The first ones are
// character types; the roast labels (Excuse Maker onward) are for the players who have earned it.
export const LABELS: LabelDef[] = [
  {
    key: "gunner",
    name: "Gunner",
    blurb: "Shoots first and asks no questions",
    lines: {
      cold: ["{n} went {fg}. Never once considered passing.", "{fg} for {n}. Every one of those was a decision they made."],
      hot: ["{n} shot {fg}. Fine, the gunner was right this time."],
      mvp: ["{n} took every shot and most of them went in. MVP, and now they will shoot more."],
      tov: ["{n} had {k} turnovers, most of them forcing a shot nobody wanted."],
      up: ["{n} scored {pts} a game tonight against a usual {avg}. The shots finally fell and they will not let it go."],
      down: ["{n} scored {pts} a game against a usual {avg}. That is a lot of shooting for that little scoring."],
      owned: ["{n} lost to {o} again, {r} all time. Shooting over them has not worked yet."],
    },
    injury: ["Sore shooting wrist. Not from passing."],
  },
  {
    key: "ballHog",
    name: "Ball Hog",
    blurb: "Passing is a rumor",
    lines: {
      tov: ["{n} had {k} turnovers. Teammates were open for most of them.", "{k} turnovers for {n}, and zero of them were passes."],
      cold: ["{n} kept the ball all night and went {fg}. Somebody else could have tried."],
      zero: ["{n} had the ball plenty and still scored zero in {g} games."],
      up: ["{n} had {pts} a game tonight, up from {avg}, and held the ball for most of it."],
      down: ["{n} scored {pts} a game against a usual {avg}, with the ball all night. Passing might have helped."],
    },
    injury: ["Sore thumb from holding the ball too tight."],
  },
  {
    key: "brickLayer",
    name: "Brick Layer",
    blurb: "Lots of misses off the rim",
    lines: {
      cold: ["{n} went {fg}. Another night of bricks.", "{fg} for {n}. The rim has seen all of it."],
      zero: ["{n} scored zero in {g} games. Every shot was a brick."],
      hot: ["{n} shot {fg}. Mark the date, the bricks stopped."],
      up: ["{n} scored {pts} a game tonight against a usual {avg}. Fewer bricks, more buckets."],
      down: ["{n} scored {pts} a game against a usual {avg}. The bricks are back."],
      revenge: ["{n} finally got one back on {o}, {r} all time. Bricks and all."],
    },
    injury: ["Sore back from carrying all those bricks."],
  },
  {
    key: "cardioVillain",
    name: "Cardio Villain",
    blurb: "Gassed after the second possession",
    lines: {
      cold: ["{n} went {fg} and was winded before the second game."],
      noshow: ["{n} skipped the night. Easier than running."],
      streakL: ["{n} has lost {k} in a row and cannot run it off."],
      winless: ["{n} went 0-{l}, and looked tired by the second quarter of each one."],
    },
    injury: ["Winded. Doctors say that is not a medical condition."],
    away: ["Out of town, and probably sitting down."],
  },
  {
    key: "trashTalker",
    name: "Trash Talker",
    blurb: "All mouth, sometimes backed up",
    lines: {
      winless: ["{n} went 0-{l} after all that talking.", "0-{l} for {n}. The talking was louder than the scoring."],
      streakL: ["{n} has lost {k} in a row and is somehow louder."],
      sweep: ["{n} went {w}-0, so nobody will hear the end of it this week."],
      streakW: ["{n} has won {k} straight, and the talking has gone up with every win."],
      mvp: ["{n} won MVP, so for once the talking was backed up."],
      revenge: ["{n} finally beat {o}, now {r} all time. Expect a lot of talking."],
      owned: ["{n} lost to {o} again, {r} all time. Fewer words next time."],
      up: ["{n} scored {pts} a game against a usual {avg}. The talking has numbers behind it for once."],
      down: ["{n} scored {pts} a game against a usual {avg}. All talk, no points."],
    },
    injury: ["Lost their voice. The quiet is the real injury."],
  },
  {
    key: "dunkMachine",
    name: "Dunk Machine",
    blurb: "Lives above the rim",
    lines: {
      hot: ["{n} shot {fg} and kept getting above everyone."],
      mvp: ["{n} played above the rim all night. MVP, and the dunk count will be brought up."],
      cold: ["{n} went {fg}. Nothing going down tonight, dunks included."],
    },
    injury: ["Bruised hip after a hard landing."],
  },
  {
    key: "lockdown",
    name: "Lockdown",
    blurb: "Wall at the rim and on the perimeter",
    lines: {
      mvp: ["{n} locked people up all night and scored {pts} on top. MVP."],
      sweep: ["{n} went {w}-0 and nobody scored easily on them."],
      streakW: ["{n} has won {k} straight, mostly because nobody can score on them."],
      owned: ["{n} lost to {o} again, {r} all time. Even the best defense has a problem opponent."],
      revenge: ["{n} finally got past {o}, {r} all time."],
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
      hot: ["{n} shot {fg}. Calm under pressure, as they will tell you."],
      cold: ["{n} went {fg}. Called for the last shot and did not get it done."],
      up: ["{n} scored {pts} a game tonight, up from {avg}. Early shots count too."],
      revenge: ["{n} beat {o} again when it counted, {r} all time."],
    },
    injury: ["Day-to-day, but will be there for the last possession."],
  },
  {
    key: "lateArrival",
    name: "Late Arrival",
    blurb: "Fashionably late, or not at all",
    lines: {
      noshow: ["{n} did not show up. Still on the way, probably.", "{n} missed the night. Expect a text saying on my way."],
      streakL: ["{n} has lost {k} in a row, and keeps missing the first game."],
      winless: ["{n} went 0-{l}, and showed up late for most of it."],
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
      tov: ["{n} had {k} turnovers. Gave away the ball and the chips."],
      zero: ["{n} scored zero in {g} games, but brought good snacks."],
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
      cold: ["{n} went {fg}. The knees did not cooperate."],
      noshow: ["{n} skipped the night to rest the knees."],
      mvp: ["{n} won MVP on experience alone, and the knees held up."],
      streakW: ["{n} has won {k} straight on smart play, not speed. Younger players are taking notes, or ice."],
      up: ["{n} scored {pts} a game tonight, up from {avg}. The knees were worth it."],
      down: ["{n} scored {pts} a game against a usual {avg}. The knees had a say."],
    },
    injury: ["The knees made the call.", "Pulled a muscle getting out of the car."],
    back: ["Knees cleared to play."],
  },
  {
    key: "rookie",
    name: "Rookie",
    blurb: "New and still learning where the line is",
    lines: {
      mvp: ["{n} is the rookie and the MVP. The veterans are not enjoying this."],
      winless: ["{n} went 0-{l}. Welcome to the league."],
      cold: ["{n} went {fg}. Still learning the court."],
      streakL: ["{n} has lost {k} in a row. That is what rookie year costs."],
      up: ["{n} scored {pts} a game tonight against a usual {avg}. The rookie is learning."],
      revenge: ["{n} beat {o}, {r} all time. Not bad for a rookie."],
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
      zero: ["{n} scored zero in {g} games. All passes, no shots."],
      sweep: ["{n} went {w}-0 and made everyone else better."],
    },
    injury: ["Sore wrist from too many no-look passes."],
  },
  {
    key: "hustle",
    name: "Hustle Guy",
    blurb: "Dives for everything",
    lines: {
      mvp: ["{n} hustled their way to MVP and has a few scrapes to show for it."],
      streakL: ["{n} has lost {k} in a row, and still dove for every loose ball."],
      noshow: ["{n} missed the night, so nobody dove for loose balls."],
    },
    injury: ["Scraped knee from diving for a ball that was out of bounds."],
  },
  {
    key: "excuseMaker",
    name: "Excuse Maker",
    blurb: "It was never the shot, it was the sun",
    lines: {
      cold: ["{n} went {fg}. Expect it to be the sun's fault.", "{fg} for {n}, and a list of reasons that is longer than the box score."],
      winless: ["{n} went 0-{l}, with a different excuse for each loss.", "0-{l} for {n}. The ball was slippery, the court was flat, the sun was out."],
      streakL: ["{n} has lost {k} in a row, and the excuses keep coming."],
      noshow: ["{n} skipped the night and sent a long reason. Nobody asked."],
      tov: ["{n} had {k} turnovers. Somebody bumped them, apparently."],
      owned: ["{n} lost to {o} again, {r} all time. The excuse list is getting long."],
      down: ["{n} scored {pts} a game against a usual {avg}. A reason is already on the way."],
    },
    injury: ["Hurt by the wind, the sun, and everyone else."],
    away: ["Away. The reason is long and nobody asked."],
  },
  {
    key: "matador",
    name: "Matador",
    blurb: "Defense is a polite wave as people go by",
    lines: {
      cold: ["{n} went {fg}, and the defense was no better."],
      winless: ["{n} went 0-{l}. Nobody got stopped by them in any of it."],
      streakL: ["{n} has lost {k} in a row. Opponents walk right by."],
      sweep: ["{n} went {w}-0, so the defense actually showed up."],
    },
    injury: ["Pulled a muscle waving at someone driving past."],
  },
  {
    key: "butterfingers",
    name: "Butterfingers",
    blurb: "The ball slides right out",
    lines: {
      tov: ["{n} had {k} turnovers. Catching is optional, apparently.", "{k} turnovers for {n}. Try grip tape."],
      cold: ["{n} went {fg}, and the ball kept slipping out early."],
      zero: ["{n} scored zero in {g} games and dropped most of the passes."],
    },
    injury: ["Hurt a hand dropping something simple."],
  },
  {
    key: "foulMagnet",
    name: "Foul Magnet",
    blurb: "Every possession ends in a whistle",
    lines: {
      foul: ["{n} was called for {k} fouls. That is almost a game of free throws.", "{k} fouls for {n}. Same as every week."],
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
      streakL: ["{n} has lost {k} straight and is not handling it well."],
      cold: ["{n} went {fg} and blamed the rim."],
      noshow: ["{n} skipped the night after the last loss. Still mad."],
      owned: ["{n} lost to {o} again, {r} all time. Expect a text."],
      revenge: ["{n} finally beat {o}, {r} all time, and wants everyone to know."],
    },
    injury: ["Strained something throwing a ball after the buzzer."],
  },
  {
    key: "fader",
    name: "Late Fader",
    blurb: "Great early, gone when it matters",
    lines: {
      cold: ["{n} went {fg}. Good start, then nothing."],
      streakL: ["{n} has lost {k} in a row, mostly late in the games."],
      winless: ["{n} went 0-{l}, with a lead in at least a couple of them."],
      mvp: ["{n} lasted all night and won MVP. That almost never happens."],
    },
    injury: ["Ran out of gas with a lead."],
  },
  {
    key: "warmupLegend",
    name: "Warmup Legend",
    blurb: "Unbeatable until the game starts",
    lines: {
      cold: ["{n} went {fg}. Looked a lot better in warmups.", "{fg} for {n}, who was great in warmups, which do not count."],
      zero: ["{n} scored zero in {g} games after a perfect warmup."],
      winless: ["{n} went 0-{l}. The warmup went well, at least."],
      hot: ["{n} shot {fg}. The warmup form finally carried over."],
      down: ["{n} scored {pts} a game against a usual {avg}. The warmup was better."],
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
      noshow: ["{n} was not there tonight. Probably sightseeing somewhere.", "{n} skipped the night. The photos will say where they were."],
      zero: ["{n} scored zero in {g} games. More there for the view."],
      winless: ["{n} went 0-{l}. At least the photos were good."],
    },
    away: ["Out sightseeing."],
  },
  {
    key: "sleeper",
    name: "Sleeper",
    blurb: "Quiet for a while, then suddenly everywhere",
    lines: {
      up: ["{n} scored {pts} a game tonight against a usual {avg}. They were hiding it until now."],
      down: ["{n} scored {pts} a game against a usual {avg}. Back to sleep."],
      mvp: ["{n} woke up and won MVP."],
      zero: ["{n} scored zero in {g} games. Still asleep."],
      noshow: ["{n} skipped the night. Probably overslept."],
    },
    injury: ["Slept on it wrong."],
  },
  {
    key: "showboat",
    name: "Showboat",
    blurb: "Style points count, apparently",
    lines: {
      cold: ["{n} went {fg}. Lots of flair, very few points."],
      tov: ["{n} had {k} turnovers, and every one of them was a fancy pass."],
      mvp: ["{n} won MVP with style, and will bring up the highlights."],
      sweep: ["{n} went {w}-0 and made sure everyone watched."],
      up: ["{n} scored {pts} a game tonight against a usual {avg}. The show worked this time."],
    },
    injury: ["Pulled something trying a move for the crowd."],
  },
  {
    key: "hothead",
    name: "Hothead",
    blurb: "Gets worked up over every call",
    lines: {
      foul: ["{n} was called for {k} fouls and had something to say about each one."],
      winless: ["{n} went 0-{l}. Nobody could say anything to them afterward."],
      streakL: ["{n} has lost {k} in a row and everyone can tell."],
      tov: ["{n} had {k} turnovers and was mad at someone else for each one."],
      owned: ["{n} lost to {o} again, {r} all time. That one will come up at the next game."],
    },
    injury: ["Sore hand from slamming the ball down."],
  },
  {
    key: "underdog",
    name: "Underdog",
    blurb: "Nobody picks them, they keep winning anyway",
    lines: {
      sweep: ["{n} went {w}-0. Nobody picked them and nobody can say why."],
      streakW: ["{n} has won {k} straight and is still being picked last."],
      mvp: ["{n} won MVP. Pick them earlier next time."],
      revenge: ["{n} beat {o}, {r} all time. The underdog is catching up."],
      up: ["{n} scored {pts} a game tonight against a usual {avg}. Nobody saw it coming."],
    },
    injury: ["Hurt, and still the underdog."],
  },
]

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
  up: ["{n} the {label} scored {pts} a game tonight, well above the usual {avg}."],
  down: ["{n} the {label} scored {pts} a game tonight, well below the usual {avg}."],
  revenge: ["{n} the {label} finally got one back on {o}, now {r} all time."],
  owned: ["{n} the {label} lost to {o} again, {r} all time."],
}

// Everything stored for a player: label keys, plus their own lines written as "@event|text".
const rawOf = (state: PooleanState, playerId: string): string[] => ((state.playerLabels ?? {}) as Record<string, string[]>)[playerId] ?? []
export const isOwnLine = (entry: string) => entry.startsWith("@")
export const ownLine = (event: LabelEvent, text: string) => `@${event}|${text}`
export function parseOwnLine(entry: string): { event: LabelEvent; text: string } | null {
  const bar = entry.indexOf("|")
  return isOwnLine(entry) && bar > 1 ? { event: entry.slice(1, bar) as LabelEvent, text: entry.slice(bar + 1) } : null
}
export const labelsOf = (state: PooleanState, playerId: string): string[] => rawOf(state, playerId).filter((k) => !isOwnLine(k))

// Headlines the editor has thumbed down. They are skipped when there is another wording to use, and dropped otherwise.
let hidden = new Set<string>()
export const setHiddenLines = (lines: string[]) => {
  hidden = new Set(lines)
}
export const isHidden = (text: string) => hidden.has(text)

const fill = (text: string, vars: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

// A headline from the player's own labels for this kind of moment, or null when they have none that fit.
export function labelLine(state: PooleanState, playerId: string, event: LabelEvent, vars: Record<string, string | number>, seed: string): string | null {
  const keys = labelsOf(state, playerId)
  const lines: string[] = []
  // The editor's own lines for this player come up three times as often as the library ones.
  for (const entry of rawOf(state, playerId)) {
    const own = parseOwnLine(entry)
    if (own && own.event === event) lines.push(own.text, own.text, own.text)
  }
  for (const k of keys) {
    const def = labelDef(k)
    if (def) lines.push(...(def.lines[event] ?? []))
    else lines.push(...GENERIC[event].map((t) => t.split("{label}").join(k.toLowerCase())))
  }
  const shown = lines.map((l) => fill(l, vars)).filter((l) => !hidden.has(l))
  if (shown.length === 0) return null
  return pick(seed + playerId + event, shown)
}

// Injury report notes drawn from a player's labels, for the dice button.
export function labelInjuryNotes(state: PooleanState, playerId: string, kind: "injury" | "away" | "back"): string[] {
  return labelsOf(state, playerId).flatMap((k) => labelDef(k)?.[kind] ?? [])
}
