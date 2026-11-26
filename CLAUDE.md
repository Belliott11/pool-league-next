# Working on Poolean Intel

Pool basketball league stats site. React 19, Vite, TypeScript, Tailwind v4. Live at https://belliott11.github.io/pool-league-next/
and https://intel.poolean.net (the user's domain, served from the same Pages build), deployed from `main` by `.github/workflows/deploy.yml`. League terms are defined in `CONTEXT.md`; use them.

## Rules

- No em dashes in any site text. Avoid "worst" style labels. Use they/them for anyone whose pronouns are not stated (the regulars are
  he, Kayla is she).
- Before pushing: `npx tsc -p tsconfig.app.json --noEmit`, `npx vitest run`, `npm run build`. After pushing to `main`, check the deploy
  run passed before saying anything is live. If it fails with "No artifacts named github-pages were found", rerun it.
- League data is one `league_state` row in Supabase project `cthhlwvhmpvthpkivwps`; `league_state_history` holds snapshots. Read it over
  REST with the anon key in `public/cloud-config.json` (never print the key). Before changing or deleting league data: ask first, insert
  a snapshot into `league_state_history`, then verify counts after.
- `src/lib/stats.ts` and `src/lib/legacy-core.ts` compute the same stats and must stay equal.
- Headline style is B+C: specific, deadpan, everyday. "Rerun the reads" and "rerun the headlines" are on-request recipes. Hand-written
  lines live in `src/data/custom-headlines.json` and `src/data/advanced-reads.json`.
- "Now what" from the user means: pitch new ideas (features or analysis not built yet), not a maintenance or pre-season checklist.
- To test an editor screen without signing in, make a temporary `_x.html` plus `src/_x.tsx` that renders the component with live state in
  `src/_state.json`. Delete all three before committing, and never commit the state file. `public/test-data.json` (a copy of live state)
  is also never committed; the tests that need it skip without it.

## Filter defaults

Outlier games count by default until the league has 20 filmed games (`OUTLIERS_OFF_AT` in `src/lib/filters.ts`), then are left out by
default. App calls `setFilmedGames` before working out the filters. The phone saves `outliers` only when it differs from the default
(`storeToggles` in `src/lib/toggles.ts`), so the default can move for everyone who has not chosen. "Default" everywhere (written reads,
the Filters badge, the reset) means `defaultFilters()`.

Leaving outliers out only changes averages, rates and models (everything reading `qualifyingGamesForPlayer`). Records, best games,
personal bests, streaks, night recaps and highlights read every game's own line (`playerLine`, `recordBook`, `bestGames`) and never
change with it. Which games are outliers is worked out fresh from the player's current games on every call (no cache), so each new stat
entry can move a game in or out. `src/lib/outliers.test.ts` checks all three, in both stat engines.

## Written text and Filters

The written reads and headlines are for the default Filters. With any other filter, `writtenReadFor` and `customStories`/`customNight`
return null, so the Player page, Advanced reads, Wrapped and the headline lists show the versions worked out live, which follow the
filters. Lines are only saved for visitors (`publishedStories`) at the default filters.

## Rerun the reads and headlines (recipe)

1. Save live state to `public/test-data.json` (never committed). A temporary `src/_rerun.test.ts` stubs `localStorage`, imports with
   `await import`, calls `setPaceGames(state.games)` (as App does; without it every per-game number is slightly off) and
   `syncLegacy(state, DEFAULT_TOGGLES)`, then writes `advancedReads`, `seasonStories`, `previewStories`, `awardRace`, `ratings` and the
   leaderboard rows to a file (console output is swallowed).
2. Check every number in `advanced-reads.json` and `custom-headlines.json` against that. Old-site pair records come from
   `src/data/poolean-seasons.json`. To tell rule changes from data changes, compare the games' event lists with a `league_state_history`
   snapshot from the `writtenAt` date.
3. Rewrite what drifted (B+C style), set `writtenAt`, bump `filmedGames` if games were added, and run `npx vitest run` with the test file
   present (the written-read checks run then). Delete the temporary test and the state file before committing.

## Clips

- `src/lib/clips.ts` finds clip candidates from the shot log and applies the editor's reviews (`game.clipReviews`, type `ClipReview`):
  keep or skip, note (never shown, only matched to headlines), crop, trim, who, looks (good or bad per player), follow path, hand-picked
  stills (keys prefixed `still|`). A "bad" look makes a clip rough for that player: only shown with bad news about them.
- Editor screens: `src/pages/games/ReviewClips.tsx`, `PlayerClipsPanel` on the Players page, `src/components/CutPreview.tsx`.
- Following (`src/lib/track.ts`): players are followed automatically from one tap; the ball by hand, a tap every half second. Automatic
  ball finding failed on this footage, so do not retry it. "Follow whoever has the ball" chains players: the editor taps the carrier at
  the start and at each change of hands that `src/lib/ballCarrier.ts` lists from the shot log (pass and rebound times are estimated
  around the logged shot). Players cannot be told apart automatically: caps vary and are not recorded.
- The followed version is the one shown everywhere: a clip with a follow path is cut with the follow camera baked in (below), and until
  its cut exists `ClipBackdrop` follows it in the browser at every size. The static crop onto the pool still applies only to backdrops
  narrower than 640px (`SMALL`). Tiles show the play's 1200px picture before the 400px frame saved in the browser (that one blurred
  when zoomed). Hand-picked stills are labelled "Moment".
- Video frames can only be read (stills, following) on the live origin: the R2 bucket's CORS allows only belliott11.github.io and
  intel.poolean.net. Headless
  browsers run IntersectionObserver fine; the user's hidden preview pane does not.

### Short clip files

Every clip plays from its own ~1.2 MB file instead of seeking into a 150 to 280 MB recording. `npm run cut-clips`
(`scripts/cut-clips.mjs`) cuts each clip's stretch (`cutWindow` in `src/lib/clipCuts.ts`: 5 s before to 6 s after, or the editor's trim)
with ffmpeg, uploads it to the `pooleanintel` bucket under `clips/`, and lists it in `src/data/clip-cuts.json`. A followed clip's cut has the
follow camera in it (crop to 1/zoom along the smoothed path, `cutPath` and `clipCutKey` in clipCuts.ts; its key ends `|f<tag>` of the path
and zoom, so changing the follow cuts it again, and `clipSource(...).followed` tells players not to crop it again); its share picture is
cropped the same way. Share ids stay on the plain key. Clips not in the list
play from the full recording, so a new or re-trimmed clip works before it is cut. `.github/workflows/cut-clips.yml` runs it nightly
and commits the list; it needs the `CLOUDFLARE_API_TOKEN` repository secret (an R2 token with Admin Read & Write, since bucket-scoped
tokens only work with the S3 API). In a cloud session the same token is saved on the "pool-league-next" environment for
api.cloudflare.com.

### Share links and pictures

`npm run cut-clips` also saves a picture of each play (`clips/.../<name>.jpg`) and lists shareable clips in
`src/data/clip-shares.json` (never one that goes badly for someone). The build writes `clip/<id>.html` for each (the `clipPages` plugin
in `vite.config.ts`): the preview title and picture, then a redirect to `#/games/clip/<id>` (`src/pages/games/ClipPage.tsx`). Ids come
from `clipId` in `src/lib/clipShare.ts`. Clip tiles have a Share button. A shareable clip that knows where the play is (a follow path or the
editor's crop) also gets a vertical video for Instagram stories and reels (`makeVertical` in cut-clips: 80% of the height, 9:16, following
the play across and down, 720x1280, "POOLEAN INTEL" at the top, what, who, the date and the address at the bottom; `vertical` and
`vstyle` in clip-shares.json, `VERTICAL_STYLE` to remake them); the tile's phone button hands it to the share sheet as a file, else
downloads it (`VerticalClip` in ClipTile.tsx). The recordings have no sound, so neither do the clips. Every link that is sent (share buttons, link previews) uses the public
address in `src/lib/site.ts` (`https://intel.poolean.net/`; the clip pages' copy is `SITE` in `vite.config.ts`).

### Season trailer

The same script joins the season's 8 best plays (two per game at most, none rough, followed where set) into
`clips/trailer/season-<hash>.mp4` (`makeTrailer`): a title card ("POOLEAN INTEL, Top plays, summer <year>"), then each play with the
run-up at normal speed and the play slowed to 60% (marked "SLOW MOTION"), a caption bar (what and who, the date, "Play n of 8"), a
different xfade transition into each, light colour grading, and an end card with the address. No sound. Fonts from `scripts/og-fonts`.
Rebuilt when the plays change or `TRAILER_STYLE` is bumped; `--trailer-preview` builds it into the work folder from the uploaded cuts
without uploading. Listed in `src/data/trailer.json`. The Top plays card on the home page
(`src/pages/games/TopPlays.tsx`) has the button.

## Headlines and clips

`src/lib/headlineClips.ts` gives a headline a clip only when it knows who the headline is about and whether it is good or bad news for
them: the editor's mark (`state.headlineTones`, set from the clapperboard beside each headline, `src/components/HeadlineTone.tsx`),
else `src/data/headline-tones.json`. Clips are never reused across headlines shown together. The dialog offers a guess for unmarked headlines
(`src/lib/toneGuess.ts`, a word count over the marked ones, shown only when at least 80% sure); it is never applied by itself.

## Recordings

Live games save `startedAt`, `endedAt` and an `at` time on every basket (the editor's in the site, friends' in the `live-score`
function, version 4, which takes the phone's tap time when it is within the last six hours). Uploading a recording reads when it started
(`src/lib/recordingTime.ts`: the MP4/MOV "mvhd" header, kept in original phone files; else the file's date less its length), saves it as
`recordedAt` on the shared recording or game, and places each live-scored game in it by the clock (`placeGames`; a start typed by hand
is never moved). "Use the live baskets" in stat entry then gives each shot its video time (1.5 s before the tap). Finding game breaks
from motion in the video was tried: right on one recording, wrong on one of two breaks on another, so it is not used.

## Reviews (instant replay, after the game)

"Review that" on the live screens (`src/components/ReviewThat.tsx`: the editor's scoring screen saves it directly; friends' watch screen
sends it to the `live-score` function, version 7, action `review`) saves the moment it was tapped, an optional note and who flagged it,
in `game.reviews` (type `Review`). Once the recording's start time is known, `reviewTime` in `src/lib/reviews.ts` places each one in the
video, and the Reviews card under the game video (`src/pages/games/ReviewsCard.tsx`) replays it from 8 s before to 3 s after, looping,
at normal, 0.5x or 0.25x speed; the editor records "Call stands" or "Overturned". Without a recording time, the editor can set the moment
from where the video is.

Live stream with instant replay: anyone at the game pastes the unlisted YouTube live link (`src/components/StreamLink.tsx`; the editor's
screen saves it directly, friends' through the function's `stream` action, which accepts only https YouTube links), saved as
`game.streamUrl`. Both live screens show it (`src/components/LiveStream.tsx`) with Replay 10s, 30s and Live buttons. A "Review that"
from a phone watching the stream saves where the stream was (`videoTime`), exact without any clock. When the game finishes, the stream
becomes the game's video (`finishLive`, and the function's finish) unless it already has one. YouTube is blocked in this cloud
environment, so the player itself can only be tested on the live site.

## Player page

Summary first (`src/pages/PlayerDetail.tsx`): the header, an "At a glance" card (`src/pages/PlayerGlance.tsx`: standing, win rate,
assists, true shooting, best at and work on from the scouting report), then tabs (Overview, Shooting, Defense, Passing, Matchups,
History) holding every panel. "Jump to a panel" switches tabs through the `panel-section` event in `src/lib/jump.ts`. The Defense tab
opens with "Who stops whom" (`src/pages/PlayerDefense.tsx`, `src/lib/playerDefense.ts`): points allowed per shot guarded against what
the same shooters score on everyone else (leaning on the league's points per shot by 10 shots), ranked at 10+ shots guarded, with the
pairs both ways (shooters they guard, defenders who guard them, 4+ shots each). Who guarded a shot comes from `defendersOf` in
`src/lib/matchupRecord.ts`: the tagged defenders, else the game's matchups list, but only on a contested shot (no contest logged or
"No contest" usually means the listed defender was not there, so nobody is charged; changed 2026-11-25). The Leaderboard's Matchup
Record and Points added (`epa.ts`) use the same rule.

## Leaderboard

The same pattern (`src/pages/Leaderboard.tsx`): a "League at a glance" card (`src/pages/leaderboard/LeagueGlance.tsx`: top three by
Two-Way/G and the points, assists, rebounds and true shooting leaders, 3+ games), then tabs (Overview, Shooting, Defense, Matchups,
Trends, History, and Models for editors). Both pages use `PageTabs`, `TabGroup` and `useJumpTab` from `src/components/PageTabs.tsx`;
the tab row pins under the site header by measuring it.

## Search, throwback, app card

- Search (`src/components/SiteSearch.tsx`): players, games and pages, from the bottom bar's Search on a phone, the tab row on a wider
  screen, or Ctrl/Cmd+K. It navigates with App's own `go` and `openPlayer`.
- Throwback of the day (`src/pages/games/Throwback.tsx`) on the off-season home: one play a day from the clips in `clip-shares.json`
  (never rough), the same for everyone that day, stepping through every one before repeating; "Another" steps on for that visit.
- Search also answers "Ben vs Zach": their record against each other and as teammates over every result (`pairRecord` in
  `src/lib/headToHead.ts`, from the old site's full results list), and opens the head-to-head page `#/games/h2h/<a>,<b>`
  (`src/pages/games/HeadToHeadPage.tsx`). That page is "Settle it" (a Games home button, and in search): two pickers that change the
  address (so a debate is a shareable link; `#/games/h2h` alone starts on the pair who met most), the all-time record, a tale of the
  tape (`src/lib/debate.ts`: ten stats the site already works out, each with a minimum sample, the better number in bold and the
  verdict as rows won), their best filmed games against each other, a "Share this debate" text, then the filmed head-to-head card.
- The Filters menu has "Back to the default filters" when any filter is changed.
- Accessibility: every Leaderboard and Player tab, the Games home and search pass axe (WCAG 2.1 AA) in both themes. Mark thin samples
  with italics or a dashed border, never by fading (fading fails contrast).
- Home screen tip (`src/components/HomeScreenTip.tsx`): on an iPhone or iPad in the browser (never from the home screen or on a computer),
  from the second visit, after "Who are you?" and the colors tip are done, so only one tip shows at a time. "Got it" hides it for good,
  "Not now" for a month. On the home screen iOS keeps the saved stats that Safari clears after a week unused.
- Link preview picture (`scripts/og-image.mjs`, the `ogImage` plugin in `vite.config.ts`): each build draws a 1200x630 picture from the
  live league data (before opening night the countdown and last season's best records; in season the standings) as `og/<date>.png` and
  points og:image at it, falling back to the icon if the data cannot be fetched. Fonts are fixed-weight copies of the site's own in
  `scripts/og-fonts` (the renderer cannot pick weights in variable fonts). deploy.yml also runs daily at 20:05 UTC, just after the countdown
  drops a day, counted exactly as the site's (`countdownTo`). In a cloud session Node's fetch needs `NODE_USE_ENV_PROXY=1` and
  `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` to reach Supabase, or the build quietly keeps the icon.
- Scrollable tables (`src/lib/scrollHints.ts`, started in `App.tsx`): any table wider than its box (`[data-slot="table-container"]`,
  `.table-scroll`, `.overflow-x-auto`) fades its right edge while there is more to the right (`data-more-right`, index.css) and shows
  "Swipe for more columns →" (phones) or "Scroll sideways for more columns →" underneath until scrolled once. Right edge only: the main
  stat tables pin the player column on the left.
- The off-season home links to Adam's iPhone app, Poolean (App Store id 6783053933), for party power rankings and the rules.

## Phone screen edges

The page uses the whole screen (`viewport-fit=cover` in `index.html`). Without it, iOS stops the bottom bar above the home indicator and
the page shows through below it. So anything at a screen edge pads with `env(safe-area-inset-*)`: the bottom bar, the page's bottom
padding in `App.tsx`, the body's sides (`index.css`) and the full-screen Wrapped view.

## Speed

Clip tiles loop the play silently at rest, like the profile header (`ClipBackdrop`: on screen only, two at most at once, still with Reduce
Motion or Data Saver; a backdrop that stops frees its slot for the next). Until a tile plays it shows the play's saved picture
(`posterOf` in `src/lib/clipShare.ts`, about 80 KB), and its clip downloads only when it is going to play, so tiles scrolled past cost
the picture alone. A tap plays with sound and controls, started inside the tap (iPhones allow sound only then) with the start time in the
address (`#t=`). The offline cache (`main.tsx`, `public/sw.js`) takes only the site's own files and fonts,
never videos or league data, and only after the page has settled. The first service worker taking control does not reload the page (only a new
deploy's worker does, for a returning visitor); that reload made a first visit load everything twice. Measured 2026-11-24 on a throttled
phone (slow 4G, 4x CPU): Games home 5.0 MB to 1.3 MB, about 4.3 to 5.2 s to the real page, mostly CPU; the league data is 45 KB gzipped.
Visitors' phones save the last league data they downloaded (`src/lib/viewerCopy.ts`, its own localStorage key, apart from the editor's
copy) and open on it at once (`cloud.early` in `App.tsx`); the fresh copy swaps in under the same page. A repeat visit on the throttled
phone shows the Leaderboard in 1.6 s instead of 4.4 s. With no signal the saved copy stays, minus any game it shows as live, with
"No connection. Showing the stats as of ..." (`SavedCopyNote`); start-up retries when the phone comes back online. A phone known to be an
editor's (`knownEditor`) never shows the saved copy first.
Avatars use 160px WebP copies (`public/photos/sm`, `playerThumbUrl`); run `scripts/photo-thumbs.sh` after adding a photo. The league
data is fetched with a plain request (`fetchPublic` in `src/lib/cloud.ts`) while the database library loads.

## Votes and predictions

Pick'em votes and preseason predictions belong to the phone that made them: `src/lib/deviceKey.ts` keeps a private key on the phone, and
the database functions `cast_pickem_vote` and `save_season_prediction` keep only its hash (`owner_hash`) and refuse changes from another
key (`supabase/pickem.sql`, `supabase/predictions.sql`). Direct writes to both tables are refused (only the read policies remain), so
the functions are the only way in.

## New season

`startNewSeason` (`src/lib/newSeason.ts`) closes a season by recording dates only: the ended season goes into `seasonHistory` with its
name, and `currentSeasonStartedAt` moves to the new date. Games, players, labels and recordings (`masterVideos`, which every game video and
clip plays from) are never touched. From opening night until a season is started, the editor's Games home asks for it
(`src/pages/games/NewSeasonPrompt.tsx`, starting on the opening night's date). The classic Data Management button uses the same function;
it used to clear `masterVideos`, which on this site would have broken every game video. Rehearsed on a copy of live data (2026-11-24):
standings and award races start empty, season panels borrow the last 10 games with a note, records and all 153 clips are unchanged.
Season Wrapped follows the current season, so last season's Wrapped goes once the new season starts.

Pick'em also opens for live games until their first basket (`liveOpenForVotes` in `src/lib/pickem.ts`): most games go live the moment
teams are picked, so before this Pick'em never opened on a game night. Both live screens show "Who wins this one?" (`LivePickem` in
`src/pages/games/PickEm.tsx`) until then, and the vote counts in the Pick'em standings once the game is finished.

## How the numbers work, and runs

`#/games/how` (`src/pages/games/HowItWorks.tsx`, linked from the Games home and search) explains each model on a real moment, all worked
out live: the live odds on one basket (before, with it, and if the other team had scored it, starting on the basket that moved the odds
most; the pre-game read is `backtestPick`, from earlier nights only), runs against chance, Two-Way added up term by term from one
player's game with that player's outlier fences, Points added on one real trip, and the rulebook's history. `src/lib/momentum.ts`: the
rules give the ball to the team scored on, so baskets alternate and a plain shuffle makes every game look less streaky than chance. Each
game's longest run is judged against that game's own rates of scoring again right after scoring (a two-state chain, counted exactly).
The league check is how often the other team answers after one basket against after two or more in a row, compared plainly: that leans
toward finding momentum (stronger teams have more runs), while splitting it per game leans the other way (the hot-hand trap). On
2026-11-25: 54% against 52%, no sign of momentum. The hot hand is checked against each player's own shots shuffled within each game
(the basket that ends a game is left out). The game page's Shots tab has "Was that run real?" (`src/components/RunCheck.tsx`), under "Replay the game"
(`src/components/GameReplay.tsx`, `src/lib/replay.ts`): every shot in order on the court (filled for a make, a ring for a miss, team
colours), the score after it, play at 1x or 2x, step, a slider and a Watch link.

## Rulebook and rule changes

Poolean's rulebook (Adam's app) is tracked in `src/data/rulebook.json` by `scripts/rulebook.mjs`, run hourly by
`.github/workflows/rulebook.yml`: it reads `https://poolean.net/api/v1/rules` when that exists, else the published
`https://poolean.net/data/rules.json` (a copy committed in Adam's repo, which does not follow edits made in the app until he publishes
it), and adds a dated version when the text changes. A `from` date can be corrected by hand when a rule changed on a game day before
play. `src/lib/rulebook.ts` matches each game to the version on its date, diffs versions line by line and sorts each change by section
(scoring, possession, boundaries, defense and contact, other). Only scoring, possession and boundaries split the model rates
(`sameMathRules`, used by `epa.ts` and `shotChoice.ts`, leaning on every game until the new rules have 8); the expected changes are to
defense and contact, which leave the math pooled. Once the rulebook has changed: the Filters menu offers "Only games under the current
rules" (`toggles.currentRules`, applied in App to the Leaderboard and Player pages only; written text steps aside), the Leaderboard's
Trends tab shows "Did the rule change work?" and the How page shows what changed (`src/components/RuleChanges.tsx`,
`src/lib/ruleImpact.ts`: fouls, roughness free throws, steals and live-ball turnovers per 10 trips, heavy contests, defenders beaten,
shooting, points per trip, offensive rebounds, out of bounds, trips per game, over every filmed game, with gameFlow.ts verdicts).

## Is a 3 worth it?

`src/lib/shotChoice.ts` and the card `src/components/ThreeWorth.tsx` (Leaderboard and Player Shooting tabs): how often a 3 has to go in
to beat a 2 at common scores, for the league and each player. Win chances come from a race to the target that knows who has the ball
(each trip scores a 2 or 3 at the league's per-trip rates, the ball changes hands after every trip, even teams). A miss is the other
team's ball unless the shooting team rebounds it; a turnover with `missEventId` is a miss ruled out of bounds. Missed 3s go out of
bounds about twice as often as missed 2s (44% against 21% on 2026-11-25) and come back half as often (12% against 25%), which raises the
bar for a 3 by about 2 points; most missed 2s are lost too. Player rates lean on the league's by `PRIOR_SHOTS` (15); only where a
player's misses go is their own, since rebounds depend on teammates.

## Points added

`src/lib/epa.ts`, cards in `src/components/PointsAdded.tsx` (Leaderboard Overview, Player Overview) and a walk-through of one real trip
on the How page: the football idea of expected points added. A trip is worth the league's points per trip (`ep`, about 0.63 on the
games the stats count); each play is scored by how far it moves that. A miss is worth nothing if it goes out of bounds, else the
in-bounds rebound rate for that shot times `ep`; the rebound settles the rest. A live-ball turnover costs `ep`, forcing one earns it, and
the defenders on a shot take the other side of its value (split when two guarded it). Assisted makes split 65/35 (`CREDIT` in
insight.ts). Over the league the offense's credits sum to zero once rebounds nobody is credited with are put back (`epa.test.ts`).
Win chance added (insight.ts) uses the race to the target from the pre-game read (`winProbabilityFrom` with `backtestPick`) on the score
alone, without the live odds' learning which team is better (that would credit early baskets twice; measured 2026-11-26: first-third
baskets +13.9 with the learning against +9.2 without, last third +13.1 against +13.2).
Wins added (`src/lib/winsAdded.ts`, a column and a line on both Points added cards): points added per game turned into wins against an
average player (not a replacement level: in a league of about a dozen friends that would only single out whoever plays least). A team
whose player adds d points over an average game (PER points) gets half plus d/(2 PER) of the scoring, and `raceWin` with the league's
point mix to the usual target turns that into a win chance (about 6% a game per point, to 16). Editors see it now, marked as a preview;
everyone sees it from `WINS_SHOW_AT` (15) filmed games. Players under 8 games are in italics.

## Game alerts, summaries, odds check, tagging

- Game alerts (web push): "Game alerts" on the Games home (`src/components/GameAlerts.tsx`, `src/lib/alerts.ts`) asks for permission on a
  tap and saves the phone's push address through `save_push_subscription` (phone-owned key, like Pick'em; `supabase/alerts.sql`). An
  iPhone gets them only from the Home Screen app. A trigger on `league_state` pings the `game-alerts` edge function (verify JWT off)
  when the set of live games changes; the function reads the league data itself and sends "Game on" and "Final" once per game
  (`push_sent`), so a stray call can only send what is true. Its signing key was made by the function and lives in `push_vapid` (only
  the service role can read it; it never passed through a session or the repo). Encryption and signing are plain WebCrypto in
  `supabase/functions/game-alerts/webpush.ts`, tested in `src/lib/webpush.test.ts`; `public/sw.js` shows the notification and opens its
  page. Turning alerts on sends one "You're set" notification. Headless browsers have no push service, so delivery to a real phone can
  only be checked on a phone; the server side was checked end to end against a test address (2026-11-25).
- Test games: a "Test game" switch on the live start screen (and "Make this a test game" during one) sets `game.test`. A test game sends
  no alerts, keeps Pick'em closed (`liveOpenForVotes`), shows a banner on both live screens, and is thrown away when it ends ("End test"
  on the editor's screen; the `live-score` function, version 7, discards it on `finish` and accepts `test: true` on `start`), so it never
  reaches the stats. "Game on" also waits a minute (`LIVE_DELAY_MS` in the game-alerts function) and goes only if the game is still live
  and not a test then, so a game started by mistake can be discarded first; "Final" goes at once.
- Game summary (`src/lib/gameSummary.ts`, `src/components/GameSummaryCard.tsx` on the game page, and two lines on the share picture):
  the final score, the winners' basket that moved the live odds most (not the one that ended it), the most Points added in the game
  (`pointsAdded(state, { only })`, filmed games), and a link to the best shareable play or the game.
- Odds tab on every game page (`src/components/OddsTimeline.tsx`, `src/lib/oddsTimeline.ts`): Team A's win chance after every basket (the
  live odds, from `backtestPick` or the saved pre-game call), pinned under the header, with every basket listed below it (who, the pass,
  the score, the move in win chance, the three biggest swings marked, a Watch link when the shot has a video time). A tap on
  a basket or the arrows on the chart mark it; scrolling does not change the selection (asked 2026-11-26).
  Live-scored games use their live baskets. It is not inside a Card: `Card` has `overflow-hidden`, which stops `position: sticky`.
- "Do the live odds mean what they say?" (`src/lib/calibration.ts`, `src/pages/leaderboard/CalibrationCard.tsx`, Models tab): the same
  moments as `liveReplay.test.ts`, grouped by how sure the odds were. On 2026-11-25 the 60-70% calls won 85% and the 80-90% calls 56%.
- Stat entry: a new shot's defender comes from the matchups list for that shooter at that moment when it names one, else the last
  shot's (`EventForm.tsx`); the contest level carries only with the same defenders. `src/pages/statentry/Untagged.tsx` lists shots with
  no defender and no contest, or a defender but no contest, with a jump to each.

## Season teams

`src/lib/seasonTeams.ts`, page `#/games/teams` (`src/pages/games/SeasonTeams.tsx`, a Games home button and in search). Teams that exist
only in the stats for a season (`state.seasonTeamSets`, the last open set is current; types `SeasonTeamSet`, `SeasonTeam`). Game nights
stay pickup. The editor names 2 to 6 teams with a captain each and runs a snake draft on the page (`onTheClock`, `draftPick`,
`undoPick`; saved after every pick, `drafting` until "Finish the draft"). The first round goes weakest captain first by power ranking
(`captainOrder`, `powerOf` in matchup.ts), since a captain is a free first pick; the board lists players by power ranking; each team
card shows its chance of beating the other teams from the pre-game model (`teamStrength`, near 50% when even). Captains for 2027:
Adam, Ben, Reilly and Phillip. Each night a member plays, they score game wins (a rivalry game, where each pickup team is all from one
season team and the two differ, counts double, `RIVALRY_WEIGHT`) plus their Wins added in filmed games, divided by the games they
played that night (so a long night is worth no more than a short one; changed 2026-11-26). Each night every team counts the
average of its best K players' nights, K the same for every team: the fewest any team had there, at least 2 (`MIN_COUNTED`); a team with fewer there gets a bench night (`bench`, the set's 25th
percentile player-night, `BENCH_PCT`) for each empty spot, so one star alone cannot stand in for a team (2026-11-26). Every night counts for every team: a team with nobody there gets a
bench night for every spot, so a lone weaker player is never worse than nobody coming (with 4 teams and about 6 a night, skipped
nights made that a real pull; 2026-11-26). A team's score is the average of all the set's nights. So roster size does not decide it and a weak extra player never hurts
(plain per-member averaging rewarded short rosters; changed 2026-11-26); turnout matters only as far as a team has nobody there. Trades and newcomers are kept in `set.moves` (`movePlayer`, dated from the page's "Moves take effect from" date; the
page lists every move for everyone, and the editor can undo the latest, `undoMove`), and `teamOn` gives the team a
player was on for each game's date, so nights stay with the team they were played for. Newcomers go to the team lowest in the standings,
ties to fewer players (`nextNewcomerTeam`, shown on the page with an "Add to" button). Teams count games from `from` to `to`; `startNewSeason` closes the open set (names it after the season) unless it starts on or
after the new date. The page shows standings, team of the night, rivalry games and each team's members. Also: a "Season team" chip on
the Player page's At a glance card (`src/components/TeamChip.tsx`), a rivalry badge on the game page, a "Rivalry game" quick-fill on the
live start screen (fills both pickup teams from two season teams), "Season team champions" in the Hall of Fame (`champions`) and the
player's team finish in Season Wrapped's awards slide. Finals night (`startFinals`, `finals`, a card at the top of the standings, hidden for now behind `FINALS_ON` in SeasonTeams.tsx
until the league decides on a championship, asked 2026-11-26): the
editor starts it, freezing the top four (two with fewer than four teams) as seeds; semifinals 1 against 4 and 2 against 3 are one game
each, the final is first to two (`FINAL_WINS`), all from rivalry games from that date, each going to the open series between its two
teams. "Call off finals" clears it (games stay). A finished set's champion (`champions`, Hall of Fame) is the finals winner when there is
one, else the top of the standings.

## Title odds, draft room, props, milestones

- Title odds (`src/lib/titleOdds.ts`, a card at the top of the Season teams standings): each team's chance of finishing first, from
  4,000 seeded runs of the nights left. A team's level is its nights so far leaned on the league's average by 3 nights; each simulated
  night adds the night-to-night spread seen across all teams' nights. "Up/down since last night" reruns it without the latest night.
  Season length is `set.nights` (editor's "Nights planned this season", default `DEFAULT_NIGHTS` 12).
- Draft room (`src/lib/draftRoom.ts`, the `season-draft` edge function, verify JWT off): the editor's "Make captain links" gives each
  team a link `#/games/teams/<set>.<team>.<key>`; the league data keeps only each key's sha-256 (`set.captainKeys`), so the public data
  cannot be used to pick. A captain's phone saves its link (localStorage `seasonCaptainLink`); the board unlocks on that team's turn.
  The function checks the key and the turn, or a signed-in editor (its own token, checked against `admins`), and only places or takes
  back picks (`undo` is editor-only). With captain links on, the editor's own picks also go through it, so picks never collide. The snake
  is `src/lib/seasonDraft.ts`, a byte-for-byte copy in the function (`draftRoom.test.ts` checks). `src/lib/draft.ts` is something else
  (the pickup-team draft helper). Pages poll every 6 to 10 s while a set is drafting, and a pick asks for a refresh at once
  (`poolean:refresh` event in useCloud). `set.lastPickAt` drives the pick clock. Refusals checked live 2026-11-26; a real pick has not been
  run against live data (it would write to it).
- Points lines (`src/lib/props.ts`, `src/pages/games/Props.tsx`): over or under each player's points in a live game, on both live screens
  under "Who wins this one?", until the first basket. Picks are phone-owned like Pick'em (`prop_picks`, `cast_prop_pick` in
  `supabase/props.sql`), which refuses a pick on yourself, on a test game, or once the game has a basket. A line is points per point of
  target over earlier games, leaned on the league's rate by 3 games, times the game's target, rounded down to a half; standings (in the
  Pick'em card) score against the line worked out again from the data, never the line a phone sent. Backed up nightly with the rest.
- Milestones (`src/lib/milestones.ts`, `src/components/Milestones.tsx` on the Player page's History tab): career points, 3s, assists,
  wins and games, win streaks, first 10/15-point and 5-assist games, each dated to its game, plus "Next up". Results come from the old
  site's list up to its last date, then this site's games; points, 3s and assists from this site's games. The `game-alerts` function
  (version 4) adds up to two milestones from the game to its "Final" alert, using a byte-for-byte copy of the file and
  `old-results.json` (`node scripts/old-results.mjs` after the old results change; `milestones.test.ts` checks both).

## Live win probability

`src/lib/live.ts`: an exact race to the target (win by 2) from the pre-game read (`predictRealMatchup`, fitted on the old site's 60 results:
power rankings, extra player, history together and against) and the baskets so far (the read counts as 20 baskets, `PRIOR_SCORES`). The live
odds start from 0.7 of the read's lean (`PREGAME_WEIGHT_LIVE`). At 0-0 the live odds equal that, so every result on record tests it.
Checked 2026-11-24 on all 44 games with a pre-game call (35 unfilmed results at their opening moment, 9 filmed games at every moment,
each game counted once, calls from earlier nights only): 0.7 is best (log loss 0.582; 0.5 gave 0.591, the full read 0.611), flat from 0.6
to 0.8. The 9 filmed games alone pointed to 0.5 or less, but they come mostly from the read's two worst nights. Over all its calls the read
is right 73% of the time, better late in the season (78%) than early (68%), and too sure at the top (its 80%+ calls won 67%). A team-specific
point mix and moving the odds by points did not help. `src/lib/liveReplay.test.ts` reruns the combined check with live data and fails if
the full read or 50/50 ever does better: then sweep the weight again with all games. The pre-game model itself is compared with
`npm run compare-models` and should not change until about 100 games.

## RSVP replies

Players answer "I'm in" or "Can't make it" for opening night themselves on the off-season home (`src/lib/rsvpReplies.ts`). Replies live
in `rsvp_replies`, written only through `save_rsvp` with the same phone-owned key as Pick'em (`supabase/rsvp.sql`), never in the league
data. The home page shows the editor's list with each player's own reply on top (`whoIsComing`); Set Up Tonight shows the phone yeses
with "Add them", so team balancing and the night preview, which read the editor's list, pick them up. A test reply made from a browser
owns that player's row: delete it after testing, or the real player cannot answer.

## Backups

`.github/workflows/backup.yml` saves the league data row, Pick'em votes, preseason predictions and RSVP replies every night as a run artifact kept 30
days (Actions tab, "Back up league data", a run, Artifacts). It fails if the league data has fewer than 5 games or players. Private labels
are not in it (editor-only). To restore league data from one: ask the user first, insert the current row into `league_state_history`
as a snapshot, then write the backup's `data` back to `league_state` id 1, and verify the counts.

## Environment

- `.mcp.json` adds four MCP servers: Playwright (`scripts/playwright-mcp.sh`) for driving pages, including the live site; Chrome
  DevTools (`scripts/chrome-devtools-mcp.sh`, version 1.12.0, no usage statistics or CrUX lookups sent to Google) for performance
  traces, network and console inspection and Lighthouse audits; and Context7 (`https://mcp.context7.com/mcp`) for current docs of the
  libraries used (React 19, Tailwind v4, Vite 8). And Poolean (`https://poolean.net/mcp`, Adam's Worker in `AdamMirmina/poolean`, `web/src/bridge.ts`):
  read-only league data, with the tools `list_players`, `list_games`, `get_game`, `player_games` and `intel_live_game`. It reads this
  site's `public/cloud-config.json`, the `league_state` row (`games[].liveInProgress`) and the `live-score` actions (start, add, undo,
  finish, review), so renaming any of those breaks it; `src/lib/pooleanBridge.test.ts` fails first.
- Cloud sessions should use the "pool-league-next" environment: it allows the live site, Supabase, the R2 video host, the weather API, Context7 and poolean.net,
  and runs `npm ci` on start.

## Adam's older games

The 50 games on Adam's old site that are not among this site's own games (summer 2026, July 5 to August 16) are already in
`src/data/poolean-seasons.json` (`src/lib/real.ts`): results only, used for old-site records, head-to-heads and the Hall of Fame. Never
import them into `league_state`, which would count them twice. There is no video and no usable recording for them, so no scores, shots or
other stats can ever be added: do not suggest filming, stat entry or clip work for them.

## Ideas not built

- A custom domain on the R2 bucket, for caching and no rate limit (`r2.dev` is rate-limited). Needs a domain on Cloudflare.
