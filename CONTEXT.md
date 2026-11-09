# Poolean Intel

A tracker for a backyard pool-basketball league: it records games, scores them live, and turns the results into standings, awards, predictions and headlines.

## Language

### Games

**Game**:
One contest between two teams. A game is either live, finished with only points, or finished with a box score.

**Live game**:
A game that is still being scored.
_Avoid_: In-progress game, ongoing game

**Reviewed game**:
A finished game that has a box score. Standings, the MVP race and the defender award count only reviewed games.
_Avoid_: Complete game, logged game

**Night**:
All the games played on one date.
_Avoid_: Session, game day

**This season**:
The games since the current season started.
_Avoid_: Current season, new season

**Past seasons**:
Earlier seasons, once there are any. Not the same as imported data, which can include the season being played now.
_Avoid_: Real games, old games

**Old site data**:
Games, ranks and awards brought in from the old site. It can cover the current season, so it is labelled by where it came from, not by when.
_Avoid_: Real site data, past seasons data

### People

**Editor**:
The one signed-in person who can change everything on the site.
_Avoid_: Admin, owner

**Visitor**:
Anyone else. Visitors can read everything and change nothing.
_Avoid_: Viewer, guest

**Scorekeeper**:
Whoever adds baskets to a live game, signed in or not. A job for one game, not a role, and it allows nothing else.
_Avoid_: Friend, watcher

### Headlines

**Headline**:
One generated sentence about a player, a game or a night.
_Avoid_: Line, quip, roast, story

**Story list**:
The group of headlines shown together on one card.
_Avoid_: Stories

**Label**:
A private tag on a player that headlines are written from. Never shown to visitors.
_Avoid_: Tag, trait

**Tone**:
How a headline is worded, such as a quip or a roast. A tone is not a separate kind of headline.

### Scores and predictions

**Defensive score**:
A player's defending value in one game: steals, blocks and stops, minus times beaten and points allowed. The defender award adds it up over this season.

**Two-way score**:
A player's offense and defense in one game, added together. The MVP award adds it up over this season.

**Two-way per 25**:
The two-way score scaled to 25 combined points scored by both teams (about one game). The 25 lives in `src/lib/per.ts`. Standings rank by it, and so does "Best player".
_Avoid_: Two-way rating

**Prediction**:
The model's win chance for a game, saved before it is played and never filled in afterward.

**Backtest pick**:
A pick for an old game, made only from the games before it. Shown on its own and never mixed with predictions.

**Scorecard**:
The record of how often the model's predictions were right. It scores predictions only, never Pick'em votes.

**Pick'em**:
A visitor's vote on which team will win a game, cast before it starts. Separate from the model's prediction.

### Offseason

**Opening night**:
The first night of next season, set by the editor.

**Offseason**:
The stretch before opening night, once its date is set. The Games tab leads with the countdown, Season Wrapped, the early power ranking and preseason predictions.

**Season Wrapped**:
One player's season told one fact at a time, from the season that just ended.

**Preseason prediction**:
A friend's call, made before opening night, on next season's award winners, top three and a power ranking of every player. Scored as the season plays out.

**Predicted players to watch**:
The players the group picks to make a jump, up to three each, most picked first. A jump is finishing at least 2 spots higher in the Standings than the season before, among players ranked in both.

**Players to watch**:
Two short lists for next season from how players finished against how they started, using box scores, points from unfilmed games, and the old site's results and power rankings: "finishing strong" (played better in the second half of their games) and "due a bounce back" (cooled off late but strong over the season). A hint from a few games, never a forecast.

**Hall of fame**:
All-time marks across every game: career leaders, best single games, records, streaks, rivalries and past MVPs.

### Game flow

**Game phase**:
One third of a game by elapsed time, from its first shot to its last: first, middle or last third.

**Hot hand**:
Shooting better right after a make than right after a miss. Measured within one game for one shooter.

**Pace, runs and swings**:
League card on the Leaderboard from games with video times. Pace counts logged plays (shots and turnovers) per minute and the time between them, since there is no possession count. A run is unanswered baskets by one team, judged against a random order of the same baskets. Lead swings are lead changes, ties and games won from behind. Shooting by score state groups shots by the shooter's team margin: trailing 3 or more, close, leading 3 or more.

**What decided games**:
Four views from finished games with a shot log, on the Leaderboard and each Player page (`src/lib/insight.ts`). Margin breakdown splits every game's margin exactly into shot quality (league points per shot of that type and contest level), shot making (made above that), turnovers and offensive rebounds (both at the league's points per shot) and everything else. Shots set up count every pass to a shot, made or missed (`passerId`), not only assists. Win chance added moves the scoring team's win chance with each basket (a random walk over the points left, games usually ending near the league's median total), crediting 65% to the scorer and 35% to the passer on assisted baskets, and debiting the defenders of baskets scored against them. Turnover cost values a possession as points over shots minus offensive rebounds plus turnovers that were not shots, and measures the other team's next shot after each turnover from video times. A shot's `turnoverEventId` marks a stolen or blocked shot, not a shot that came after a turnover.

**Player deep dive**:
Leaderboard section and Player page tab. Win impact is a ridge logistic regression over every result, with a range from resampling whole nights; it is checked by predicting each night from the others and cannot be called clear unless it beats plain win rate. Play sequences classify each timed shot by the play before it. Player identity is getting open, defenders drawn, shot choice and shrunk points per shot by zone. Body and effort tests height, build and effort across players, and shooter against defender height shot by shot.

**Trust level**:
How much is behind a number (Steady, Some data, Too early), from `src/lib/trust.ts`. A Verdict (Clear difference, A hint, Too early to tell) says whether a difference is real; a Trust level only says how big the sample is.

**Does it hold up?**:
Rules from other sports tested on league data (`src/lib/ruleTests.ts`), with a verdict of Holds up, Backwards, No sign of it or Too early. Comparisons of shots hold the court zone constant where the mix of shots would otherwise decide the result. Strategy advice only comes from rules with a real verdict.

**How teams were picked**:
`teamsPickedBy` on a game (balanced, captains, random, runback), or `oldGamePicks` in the league state for old-site games, keyed by date and teams. Random-team games are the closest thing the league has to an experiment.

**Got beat**:
A contest level for a defender beaten right before the shot. It counts as no resistance. Older shots may still be tagged Light Contest; `contestChecked` marks one that has been reviewed.

**Panel group**:
Related Leaderboard or Player panels combined into one panel with a tab each, so nothing repeats and the pages are shorter (for example Awards, Shot mix, Turnovers, Old site history). Defined in `src/lib/panelGroups.ts`. A panel that only repeated another (Season Timeline, the self-inflicted turnover bars) was dropped; tuning views (Calibrated Thresholds, Win Shares model) sit in an editor-only Developer views group.
