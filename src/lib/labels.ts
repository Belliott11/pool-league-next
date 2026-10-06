import { pick } from "@/lib/pick"
import { forPlayer } from "@/lib/pronouns"
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
      zero: ["{n} scored zero in {g} games without ever stopping shooting."],
      noshow: ["{n} skipped the night, so the shot count dropped for everyone."],
      sweep: ["{n} went {w}-0 and took every shot they wanted."],
      winless: ["{n} went 0-{l} and still took a lot of shots."],
      streakW: ["{n} has won {k} straight, and the shots keep going in."],
      streakL: ["{n} has lost {k} in a row and has not stopped shooting."],
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
      hot: ["{n} shot {fg}, so keeping the ball paid off tonight."],
      noshow: ["{n} skipped the night. The ball finally got passed around."],
      mvp: ["{n} won MVP and held the ball for most of it."],
      sweep: ["{n} went {w}-0 and kept the ball for most of it."],
      winless: ["{n} went 0-{l}. Holding the ball did not help."],
      streakL: ["{n} has lost {k} in a row and is still not passing."],
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
      tov: ["{n} had {k} turnovers on top of all the missed shots."],
      noshow: ["{n} skipped the night. The rim got a break."],
      mvp: ["{n} won MVP. Even a brick layer gets one."],
      sweep: ["{n} went {w}-0 despite the shooting."],
      winless: ["{n} went 0-{l} and missed plenty of shots along the way."],
      streakL: ["{n} has lost {k} in a row. The shooting is not helping."],
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
      hot: ["{n} shot {fg}, mostly from one spot without running."],
      tov: ["{n} had {k} turnovers, a lot of them tired ones."],
      mvp: ["{n} won MVP without being out of breath. That is a first."],
      sweep: ["{n} went {w}-0 and somehow had the legs for it."],
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
      hot: ["{n} shot {fg} and made sure everyone heard about it."],
      cold: ["{n} went {fg}, which is quiet for someone who talks that much."],
      tov: ["{n} had {k} turnovers and talked through every one."],
      zero: ["{n} scored zero in {g} games. A lot of talk, no points."],
      noshow: ["{n} skipped the night, so it was quiet."],
      foul: ["{n} was called for {k} fouls, probably for talking."],
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
      tov: ["{n} had {k} turnovers, mostly trying to throw it down."],
      zero: ["{n} scored zero in {g} games and did not get above the rim once."],
      noshow: ["{n} skipped the night, so the rim stayed safe."],
      sweep: ["{n} went {w}-0 and finished above everyone."],
      winless: ["{n} went 0-{l}. Not a lot of dunks in there."],
      streakW: ["{n} has won {k} straight, mostly on dunks."],
      streakL: ["{n} has lost {k} in a row with nothing above the rim."],
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
      hot: ["{n} shot {fg} and kept guarding at the same time."],
      cold: ["{n} went {fg}, but the defense was still good."],
      tov: ["{n} had {k} turnovers, which is rare for a defender."],
      noshow: ["{n} missed the night, so scoring got easier for everyone."],
      winless: ["{n} went 0-{l}. Defense alone was not enough."],
      streakL: ["{n} has lost {k} in a row despite the defense."],
      up: ["{n} scored {pts} a game tonight, up from {avg}, on top of the defense."],
      down: ["{n} scored {pts} a game against a usual {avg}. The defense was the point."],
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
      tov: ["{n} had {k} turnovers. Not very clutch."],
      zero: ["{n} scored zero in {g} games, not even a late bucket."],
      noshow: ["{n} skipped the night, so nobody took the last shot."],
      winless: ["{n} went 0-{l}. The last shot did not fall in any of them."],
      streakW: ["{n} has won {k} straight, mostly by winning the close ones."],
      streakL: ["{n} has lost {k} in a row, and the close ones keep going the wrong way."],
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
      hot: ["{n} shot {fg} after showing up late. Imagine on time."],
      cold: ["{n} went {fg}, still warming up when the game ended."],
      tov: ["{n} had {k} turnovers and missed the warmup."],
      mvp: ["{n} won MVP and showed up late. Do not tell them it works."],
      sweep: ["{n} went {w}-0 even after a late start."],
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
      hot: ["{n} shot {fg} on a full stomach."],
      cold: ["{n} went {fg}. Too many snacks before the game."],
      mvp: ["{n} won MVP and kept the cooler stocked."],
      sweep: ["{n} went {w}-0 and fed everyone after."],
      streakW: ["{n} has won {k} straight and the snacks are better for it."],
      streakL: ["{n} has lost {k} in a row. The snacks are carrying the group."],
    },
    injury: ["Strained something reaching for the last chips."],
    back: ["Back, and hopefully with snacks."],
  },
  {
    key: "veteranKnees",
    name: "Veteran Knees",
    blurb: "Plays smart because moving fast is gone",
    lines: {
      cold: ["{n} went {fg} and blamed the knees before the game even started.", "{fg} for {n}. The knees were consulted and have no comment."],
      noshow: ["{n} skipped the night to rest the knees."],
      mvp: ["{n} won MVP on experience alone, and the knees held up."],
      streakW: ["{n} has won {k} straight on smart play, not speed. Younger players are taking notes, or ice."],
      up: ["{n} scored {pts} a game tonight, up from {avg}. The knees were worth it."],
      down: ["{n} scored {pts} a game against a usual {avg}. The knees had a say."],
      hot: ["{n} shot {fg} without jumping once."],
      tov: ["{n} had {k} turnovers. The legs were a step slow."],
      zero: ["{n} scored zero in {g} games and saved the knees."],
      sweep: ["{n} went {w}-0 and barely moved."],
      winless: ["{n} went 0-{l}. The knees need a day."],
      streakL: ["{n} has lost {k} in a row and could use a longer warmup."],
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
      hot: ["{n} shot {fg}. The rookie is catching on."],
      tov: ["{n} had {k} turnovers. Rookie mistakes."],
      zero: ["{n} scored zero in {g} games. Still finding the rim."],
      noshow: ["{n} skipped the night. Bring the rookie next time."],
      sweep: ["{n} went {w}-0. Not a rookie result."],
      streakW: ["{n} has won {k} straight and is no longer easy to pick on."],
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
      hot: ["{n} shot {fg} for once, instead of passing."],
      cold: ["{n} went {fg} and still passed to someone worse."],
      tov: ["{n} had {k} turnovers, a few from passes that were too clever."],
      noshow: ["{n} skipped the night, so the assists took a hit."],
      winless: ["{n} went 0-{l} with plenty of assists and no wins."],
      streakW: ["{n} has won {k} straight with everybody getting touches."],
      streakL: ["{n} has lost {k} in a row, passing the whole way."],
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
      hot: ["{n} shot {fg} and dove for the misses."],
      cold: ["{n} went {fg} and still got every loose ball."],
      tov: ["{n} had {k} turnovers, a few while diving for the ball."],
      zero: ["{n} scored zero in {g} games but did the dirty work."],
      sweep: ["{n} went {w}-0 on effort alone."],
      winless: ["{n} went 0-{l} and hustled the whole way."],
      streakW: ["{n} has won {k} straight on effort."],
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
      hot: ["{n} shot {fg}. No excuses needed tonight."],
      zero: ["{n} scored zero in {g} games and has a reason for each."],
      mvp: ["{n} won MVP, so for once there is nothing to explain."],
      sweep: ["{n} went {w}-0. The excuses are on hold."],
      streakW: ["{n} has won {k} straight and has nothing to complain about."],
      up: ["{n} scored {pts} a game against a usual {avg}. The excuses can wait."],
      revenge: ["{n} finally beat {o}, {r} all time, and has no excuses to offer."],
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
      hot: ["{n} shot {fg}. The offense was fine and the defense was an afterthought."],
      tov: ["{n} had {k} turnovers, and the defense was not much better."],
      zero: ["{n} scored zero in {g} games and did not defend either."],
      noshow: ["{n} skipped the night, so nobody missed the defense."],
      mvp: ["{n} won MVP and even played some defense."],
      streakW: ["{n} has won {k} straight, defense included."],
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
      hot: ["{n} shot {fg} and for once held onto the ball."],
      noshow: ["{n} skipped the night, so the ball stayed in one piece."],
      mvp: ["{n} won MVP and did not drop it once."],
      sweep: ["{n} went {w}-0 and held onto the ball for most of it."],
      winless: ["{n} went 0-{l} with the ball slipping out of their hands."],
      streakL: ["{n} has lost {k} in a row and the ball keeps slipping."],
      streakW: ["{n} has won {k} straight with surprisingly sticky hands."],
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
      hot: ["{n} shot {fg} and picked up a few fouls."],
      cold: ["{n} went {fg} and was called for a foul on every other possession."],
      zero: ["{n} scored zero in {g} games and picked up fouls instead."],
      noshow: ["{n} skipped the night, so the whistle had a rest."],
      mvp: ["{n} won MVP, fouls and all."],
      sweep: ["{n} went {w}-0 despite the whistles."],
      winless: ["{n} went 0-{l} with a whistle on every play."],
      streakW: ["{n} has won {k} straight and fouled through all of them."],
      streakL: ["{n} has lost {k} in a row and the fouls keep coming."],
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
      hot: ["{n} shot {fg}. Hard to be mad about that."],
      tov: ["{n} had {k} turnovers and is blaming someone."],
      zero: ["{n} scored zero in {g} games and is already mad about it."],
      mvp: ["{n} won MVP, so for once the mood is good."],
      sweep: ["{n} went {w}-0. Nothing to complain about."],
      streakW: ["{n} has won {k} straight and is in a good mood for once."],
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
      hot: ["{n} shot {fg}, but see how the fourth quarter went."],
      tov: ["{n} had {k} turnovers late in games."],
      zero: ["{n} scored zero in {g} games, not even a good start."],
      noshow: ["{n} skipped the night. Finishing games is hard."],
      sweep: ["{n} went {w}-0 and finished every one."],
      streakW: ["{n} has won {k} straight and held on every time."],
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
      tov: ["{n} had {k} turnovers. The warmup did not have defenders."],
      noshow: ["{n} skipped the night and the warmup."],
      mvp: ["{n} won MVP and kept it going after the warmup."],
      sweep: ["{n} went {w}-0, so the warmup carried over."],
      streakW: ["{n} has won {k} straight, warmups and all."],
      streakL: ["{n} has lost {k} in a row and the warmup is the best part."],
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
      hot: ["{n} shot {fg} and only fell down a few times."],
      zero: ["{n} scored zero in {g} games and fell down more than they scored."],
      noshow: ["{n} skipped the night, so the floor got a rest."],
      mvp: ["{n} won MVP and stayed on their feet for it."],
      sweep: ["{n} went {w}-0 and hit the floor plenty."],
      winless: ["{n} went 0-{l} and was on the floor for most of it."],
      streakW: ["{n} has won {k} straight with a lot of falling down."],
      streakL: ["{n} has lost {k} in a row and keeps looking for a call."],
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
      hot: ["{n} shot {fg} on a quick visit."],
      cold: ["{n} went {fg}. Mostly here for the photos."],
      tov: ["{n} had {k} turnovers. Still learning where things are."],
      mvp: ["{n} won MVP and is just visiting."],
      sweep: ["{n} went {w}-0 and took pictures in between."],
      streakW: ["{n} has won {k} straight as a part-time player."],
      streakL: ["{n} has lost {k} in a row. Mostly here for the view."],
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
      hot: ["{n} shot {fg}. That woke people up."],
      cold: ["{n} went {fg}. Back to sleep."],
      tov: ["{n} had {k} turnovers. Half asleep."],
      sweep: ["{n} went {w}-0 while everyone slept on them."],
      winless: ["{n} went 0-{l} and never really woke up."],
      streakW: ["{n} has won {k} straight, and people are finally paying attention."],
      streakL: ["{n} has lost {k} in a row and might still be asleep."],
      revenge: ["{n} beat {o}, {r} all time. They did not see it coming."],
      owned: ["{n} lost to {o} again, {r} all time. Still asleep on that matchup."],
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
      hot: ["{n} shot {fg} and made sure everyone saw it."],
      zero: ["{n} scored zero in {g} games, so there was no show."],
      noshow: ["{n} skipped the night, so the highlights did not happen."],
      winless: ["{n} went 0-{l} with a lot of fancy plays and no wins."],
      streakW: ["{n} has won {k} straight and is celebrating every one."],
      streakL: ["{n} has lost {k} in a row. The fancy stuff is not working."],
      down: ["{n} scored {pts} a game against a usual {avg}. Fancy, but not effective."],
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
      hot: ["{n} shot {fg}. Fine, they were right to be mad at the rim."],
      cold: ["{n} went {fg} and had some words about it."],
      zero: ["{n} scored zero in {g} games and was mad about every one."],
      noshow: ["{n} skipped the night, probably still annoyed from last time."],
      mvp: ["{n} won MVP, and the mood was better than usual."],
      sweep: ["{n} went {w}-0, and nobody argued with them."],
      streakW: ["{n} has won {k} straight, so nothing to be mad about."],
      up: ["{n} scored {pts} a game tonight, up from {avg}. The anger helped."],
      down: ["{n} scored {pts} a game against a usual {avg}. Not a happy night."],
      revenge: ["{n} finally beat {o}, {r} all time. Probably a loud one."],
    },
    injury: ["Sore hand from slamming the ball down."],
  },
  {
    key: "underdog",
    name: "Underdog",
    blurb: "Nobody picks them, they keep winning anyway",
    lines: {
      sweep: ["{n} went {w}-0, and the people who picked them last are now quiet.", "{w}-0 for {n}. Somebody is going to have to explain the pick order.", "{n} won all {w} and is about to become a first pick, which is a bad thing for them.", "{w}-0 for {n}, and nobody saw it coming, including them."],
      streakW: ["{n} has won {k} straight and is still being picked last."],
      mvp: ["{n} won MVP. Pick them earlier next time."],
      revenge: ["{n} beat {o}, {r} all time. The underdog is catching up."],
      up: ["{n} scored {pts} a game tonight against a usual {avg}. Nobody saw it coming."],
      hot: ["{n} shot {fg}. Nobody picked them to do that."],
      cold: ["{n} shot {fg}, and the only surprise is that anyone passed to them.", "{fg} for {n}. The game plan was to let them shoot, and it worked.", "{n} went {fg} and still thinks the next one is going in."],
      tov: ["{n} had {k} turnovers, trying too hard to prove people wrong."],
      zero: ["{n} scored zero in {g} games and was picked last for the next one anyway.", "{g} games, zero points for {n}, and a very calm demeanor about it."],
      noshow: ["{n} skipped the night, so nobody was picked last."],
      winless: ["{n} went 0-{l}. The comeback is scheduled for next week, as usual.", "0-{l} for {n}, and the speech about next time is already written."],
      streakL: ["{k} losses in a row for {n}, who keeps showing up anyway, which is the whole personality.", "{n} has lost {k} straight and is somehow still optimistic."],
      down: ["{n} scored {pts} a game against a usual {avg}. Nobody expected much, and it went worse.", "{n} fell to {pts} a game from a usual {avg}, which is hard to do from there.", "{pts} a game for {n} when {avg} is normal. A bad night for a low bar.", "{n} dipped to {pts} a game from {avg}, so the bar has been moved to the floor."],
      owned: ["{n} lost to {o} again, {r} all time. The underdog story ran out."],
    },
    injury: ["Out hurt, and the first thing anyone asked was who gets the last pick now.", "Hurt in a game nobody expected them to win. That is a very specific kind of bad luck.", "Injured, and the team's odds have not changed, which says something.", "Out hurt and has been described as irreplaceable by exactly one person, who is also hurt."],
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

// Headlines the editor has reviewed. A line is identified by its wording with player names and numbers blanked
// out, so thumbing one down removes that wording for every player and every night, not just that one rendering.
let names: string[] = []
let nameRe: RegExp | null = null
let hiddenRaw: string[] = []
let okRaw: string[] = []
let hidden = new Set<string>()
let approved = new Set<string>()
export function lineKey(text: string): string {
  // Pronouns and the verbs that go with them are blanked too, so a line is the same line whichever the editor chose.
  return (nameRe ? text.replace(nameRe, "N") : text)
    .replace(/\b(they|them|their|theirs|themselves|he|she|him|her|his|hers|himself|herself)\b/gi, "P")
    .replace(/\b(is|has|knows|scores|proves|plays|keeps|comes|does|doesn't|was)\b/g, (v) => ({ is: "are", has: "have", knows: "know", scores: "score", proves: "prove", plays: "play", keeps: "keep", comes: "come", does: "do", "doesn't": "don't", was: "were" })[v] as string)
    .replace(/\d+(\.\d+)?/g, "#")
}
function rebuild() {
  hidden = new Set(hiddenRaw.map(lineKey))
  approved = new Set(okRaw.map(lineKey))
}
export const setLineNames = (list: string[]) => {
  if (list.join("|") === names.join("|")) return
  names = list
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  nameRe = list.length ? new RegExp("\\b(" + [...list].sort((x, y) => y.length - x.length).map(esc).join("|") + ")\\b", "g") : null
  rebuild()
}
export const setHiddenLines = (lines: string[]) => {
  if (lines.join("\n") === hiddenRaw.join("\n")) return
  hiddenRaw = lines
  rebuild()
}
export const setApprovedLines = (lines: string[]) => {
  if (lines.join("\n") === okRaw.join("\n")) return
  okRaw = lines
  rebuild()
}
export const isHidden = (text: string) => hidden.has(lineKey(text))
export const isApproved = (text: string) => approved.has(lineKey(text))
// Approved wordings come up twice as often as the rest.
export const weighted = (options: string[]) => options.flatMap((o) => (isApproved(o) ? [o, o] : [o]))
// How many approved wordings finish a type of line. Once a type has that many, only the approved ones are used and
// the rest of that type is no longer offered for review, so the approve and remove cycle has an end.
export const LINE_CAP = { recap: 3, label: 3, note: 8 }
export function finalSet(options: string[], cap: number): string[] {
  const ok = options.filter(isApproved)
  return ok.length >= cap ? ok : options
}
// While the review panel builds its list, every wording a headline picks from is reported here.
export const lineSink: { current: ((options: string[]) => void) | null } = { current: null }

// The moments a line can be written for, with the blanks each can use. Used by the line editor and the review list.
export const LABEL_EVENTS: { key: LabelEvent; label: string; vars: string }[] = [
  { key: "cold", label: "Cold shooting night", vars: "{fg} is their shooting line, like 2-for-9." },
  { key: "hot", label: "Hot shooting night", vars: "{fg} is their shooting line, like 8-for-10." },
  { key: "tov", label: "Lots of turnovers", vars: "{k} is how many." },
  { key: "foul", label: "Lots of fouls", vars: "{k} is how many." },
  { key: "zero", label: "Did not score", vars: "{g} is how many games." },
  { key: "noshow", label: "Missed the night", vars: "" },
  { key: "mvp", label: "Won MVP", vars: "{pts} is their points." },
  { key: "sweep", label: "Won every game", vars: "{w} is how many." },
  { key: "winless", label: "Lost every game", vars: "{l} is how many." },
  { key: "streakW", label: "On a win streak", vars: "{k} is the streak." },
  { key: "streakL", label: "On a losing streak", vars: "{k} is the streak." },
  { key: "up", label: "Scored well above their usual", vars: "{pts} is tonight's average and {avg} their usual." },
  { key: "down", label: "Scored well below their usual", vars: "{pts} is tonight's average and {avg} their usual." },
  { key: "revenge", label: "Beat someone who usually beats them", vars: "{o} is the opponent and {r} the record." },
  { key: "owned", label: "Lost to someone again", vars: "{o} is the opponent and {r} the record." },
]

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
    // Each label's lines for this moment are one type: once enough are approved, only those are used.
    const mine = def ? (def.lines[event] ?? []) : GENERIC[event].map((t) => t.split("{label}").join(k.toLowerCase()))
    lines.push(...finalSet(mine.map((l) => fill(l, vars)).filter((l) => !isHidden(l)), LINE_CAP.label))
  }
  const shown = weighted(lines.map((l) => fill(l, vars)).filter((l) => !isHidden(l)))
  if (shown.length === 0) return null
  return forPlayer(playerId, pick(seed + playerId + event, shown))
}

// Injury report notes drawn from a player's labels, for the dice button.
export function labelInjuryNotes(state: PooleanState, playerId: string, kind: "injury" | "away" | "back"): string[] {
  return labelsOf(state, playerId).flatMap((k) => labelDef(k)?.[kind] ?? [])
}
