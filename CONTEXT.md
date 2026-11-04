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
Earlier seasons brought in as imported data. Imported games belong only to past seasons.
_Avoid_: Real games, old games

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

**Two-way per 20**:
The two-way score scaled to 20 minutes of play. Standings rank by it, and so does "Best player".
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
A friend's call, made before opening night, on next season's award winners and top three. Scored as the season plays out.

**Hall of fame**:
All-time marks across every game: career leaders, best single games, records, streaks, rivalries and past champions.

### Ratings

**Rating**:
A 2K-style score from 40 to 99, from a player's last 20 box-scored games measured against everyone else who has at least 5. 74 is average; 85 and up is elite. It moves as games come in.

**OVR**:
The overall rating: mostly two-way per 20, plus the five attributes.

**Attribute**:
One of the five parts of a rating: Scoring, Shooting, Playmaking, Rebounding and Defense.

**Average miss**:
How far off a preseason power ranking ballot was: the average number of spots it missed each ranked player by. Lowest is closest.
