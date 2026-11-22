
// Plain definitions for the jargon in hand-written reads and headlines. termsIn() picks the ones a text actually uses,
// so each read and headline list can define its own terms right underneath.
const TERMS: [name: string, match: RegExp, def: string][] = [
  ["Per game", /[Pp]er game|\/G\b/, "Scaled to an average game's worth of possessions (turns with the ball), so it reads like points per game but stays fair when games run short or long. It is not a plain per-game average."],
  ["Two-way score", /two-way/i, `Offense plus defense in one number, per game. It adds up scoring, shooting, passing and ball security, then stops, steals and blocks against points allowed and times beaten. Higher is better.`],
  ["Two-Way/G", /(?!)/, "Offense plus defense in one number, scaled to an average game. Positive means a player adds more than they give up; the standings rank by it."],
  ["Backtest pick", /backtest pick/i, "What the model would have picked for a game played before picks were saved, using only the games before it. It checks the model; it never counts as a saved prediction."],
  ["TS%", /\bTS\b/, "True shooting: how many points a player scores per shot, counting threes and free throws, shown as a percentage."],
  ["Filmed game", /filmed|on film/i, "A game logged shot by shot from video. Other games only have a final score."],
  ["Results", /\d+ results|every result/i, "Every game with a recorded score, filmed or not."],
  ["Open shot", /\bopen\b/i, "A shot with no defender close enough to bother it."],
  ["Contested", /contest/i, "A defender was close enough to bother the shot or the rebound."],
  ["Points a shot (shot quality)", /points a shot|shot quality|points more than the league|below the league/i, "What a shot is worth on average for the league, given where the shooter is, the type of shot and how closely it is guarded. Higher means an easier look."],
  ["Set-up", /set-ups?\b|sets up/i, "A pass that leads straight to a teammate's shot, whether it goes in or not."],
  ["Held the ball", /held the ball|holds it|holding and/i, "The receiver kept the ball after the pass instead of shooting on the catch, which gives the defense time to recover."],
  ["Real AST", /Real AST/, "Assists that leave out the ones where the receiver held the ball and then made a contested shot on their own."],
  ["Giveaway", /giveaway|gives (the ball|it) away/i, "A turnover the player committed."],
  ["Forced turnover", /forced/i, "An opponent's turnover that this player caused."],
  ["Beaten", /\bbeaten\b|got beat/i, "The tagged defender was out of the play right before the shot, so the shot counts as wide open."],
  ["In position (stays in front)", /in position|stay(s|ed)? in front/i, "The tagged defender was not beaten and was still guarding the shooter at the shot."],
  ["Defensive load", /\bload\b|even share/i, "How many opponent shots a player was the tagged defender on, against an even split with teammates. 1.00x is an even share. Shots where the defender was beaten are left out."],
  ["Free rebound", /free rebounds/i, "A rebound nobody else fought for. These count as half when rebounds are compared."],
  ["Half court", /half court/i, "Play that is not in transition, meaning more than 8 seconds after a turnover or steal."],
  ["Win chance added", /win chance added/i, "How far a player's own plays moved their team's chance of winning, in percentage points, added up over filmed games."],
  ["Win impact (points of win chance)", /win impact|points of win chance/i, "How much more or less a player's teams win than expected against an average player, with teammates and opponents held constant. It uses every result, not just filmed games."],
]

// One term's definition by name, for an ⓘ beside a label (src/components/Explain.tsx).
export function definitionOf(name: string): string | null {
  return TERMS.find(([n]) => n === name)?.[2] ?? null
}

export function termsIn(texts: string[]): [string, string][] {
  const all = texts.join(" ")
  return TERMS.filter(([, re]) => re.test(all)).map(([name, , def]) => [name, def])
}
