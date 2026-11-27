// What each season award rewards, in one place for this site's vote (awardVote.ts) and last season's results from Poolean
// (pastAwards.ts). The point of each line is what sets an award apart from its neighbours: MVP counts how much of the season someone
// was there for, Best Player does not.
export const AWARD_TEXT: Record<string, string> = {
  mvp: "The most valuable season. Attendance counts here: a great player who came to four nights did less for their teams than a very good one who came to fifteen. Ask yourself who you would want on your team for the whole summer, knowing how often they actually showed up and how well they actually played.",
  "best-player": "The best player, full stop. Attendance does not count: this is peak ability, not the season. If everyone were there for one game with everything on it, who do you pick first?",
  "first-team": "The best players of the season, picked in one vote with the second team: places 1 to 3 make the first team.",
  "second-team": "The next three: places 4 to 6 in the same vote as the first team.",
  teams: "The six best players of the season, in order, in one vote: places 1 to 3 make the first team, 4 to 6 the second. Rank at least six if you can.",
  dpoy: "The hardest player to score on. Stops, contests, blocks and steals, guarding the other team's best shooter, and making people take shots they did not want.",
  clutch: "Who you want with the ball when the game is close and almost over. Big shots and big stops late, not totals over a whole night.",
  "mip-season": "Who got better the most over this season, from their first nights to their last: skill, decisions, confidence and how much they mattered to a game.",
  "mip-yoy": "Who came back the most improved since last summer.",
  teammate: "Who makes everyone around them better and the game more fun: the extra pass, the energy, the talking, and taking a loss well.",
  "best-duo": "The two players who were best together. Pick two players to make a pair, and rank as many pairs as you like.",
  "worst-duo": "The pairing that never quite clicked, voted in good fun. Pick two players to make a pair, and rank as many pairs as you like.",
}
