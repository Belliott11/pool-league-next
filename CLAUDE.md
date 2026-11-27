# Working on Poolean Intel

Pool basketball league stats site. React 19, Vite, TypeScript, Tailwind v4. Live at https://belliott11.github.io/pool-league-next/
and https://intel.poolean.net (the user's domain, served from the same Pages build), deployed from `main` by `.github/workflows/deploy.yml`. League terms are defined in `CONTEXT.md`; use them.

## Rules

- No em dashes in any site text. Avoid "worst" style labels (one exception, asked 2026-11-27: the voted award is called "Worst Duo"). Use they/them for anyone whose pronouns are not stated (the regulars are
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
  when zoomed). A still (picked by hand, or made from a clip's frame with "Start a still from this frame") shows as a picture: no play button, never
  played as video, no vertical video, and never a follow path, even when made from a followed clip (`reviewed` in clips.ts drops it).
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
`clips/trailer/season-<hash>.mp4` (`makeTrailer`): a title card ("POOLEAN INTEL, Top plays, summer <year>"), then each play at normal
speed from 3.5 s before its logged moment to the end of its cut (no slow motion: the logged moment is often the release or a late tap,
so the old slowed stretch around it cut plays off before the basket; removed 2026-11-26), a caption bar (what and who, the date, "Play n of 8"), a
different xfade transition into each, light colour grading, and an end card with the address. No sound. Fonts from `scripts/og-fonts`.
Reels (the trailer and mixtapes) cut each play's own stretch straight from the recording (`reelWindow` in clipCuts.ts: at least 3 s
before the moment and 5 s after, or 1.5 s past the editor's end), with the follow camera over it, because clips' trims are often tight
and cut plays off before the basket (2026-11-26). Rebuilt when the plays change or `TRAILER_STYLE` is bumped; `--trailer-preview` builds it into the work folder from the uploaded cuts
without uploading. Listed in `src/data/trailer.json`. The Top plays card on the home page
(`src/pages/games/TopPlays.tsx`) has the button.

### Player mixtapes

The same script makes each player's mixtape: their own best plays of the season (up to 6, two from a game at most, none rough, no stills,
followed where set) with the trailer's look and their name on the title card ("<NAME>, Mixtape, summer <year>"), for anyone with at
least 3 (`CLIP_MIXTAPES` in the cut plan, `MIXTAPE_STYLE`). Uploaded as `clips/mixtapes/<pid>-<hash>.mp4` and listed in
`src/data/mixtapes.json`, which the nightly workflow commits. The Player page's At a glance card has "Watch <name>'s mixtape"
(`MixtapeButton` in `src/components/ReelButton.tsx`). Nine players had one on 2026-11-26.

## Score on the game video

`src/components/ScoreOverlay.tsx` (around `GameVideo` in `GameVideoPanel.tsx`), `src/lib/scoreAt.ts`: a score bug in the corner of the
game video that follows the video's time: the score after each basket (counted `LAG` 1.5 s after the shot's video time, since that is the
release), a bar for Team A's live win chance (from `oddsTimeline`), and who scored for a moment after each basket. Only for games whose
shots have video times, and only inside the game's own stretch of a shared recording. "Score on the video" under the video hides it
(localStorage `pooleanScoreOverlay`). It sits over the page's player, so a phone's own full-screen player does not show it.

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

## A player's path through the site (2026-11-27)

First visit: a full-screen welcome over every page (`Welcome` in `src/components/WhoAmI.tsx`, a modal dialog that locks scrolling): pick
who you are (or "Just looking", or Escape), what the You tab is, what the Games tab holds. Any choice is saved on the phone, so it shows
only once. Shared play and Wrapped links skip it (the visitor came for that); a shared film link gets the small "Who are you?" bar. Once a player is
picked, the Player tab reads "You" (bottom bar and the wide-screen tabs), the Player page has "Back to you" when looking at someone
else, and the Games home's card (`src/pages/games/MyCard.tsx`) adds "Next up for you" (`src/lib/nextSteps.ts`, at most 4, most pressing
first: a live game, open Pick'em, opening-night RSVP, their season team, Wrapped in the off-season, their film, their mixtape, the rival's
head to head). A step opens a Games screen, a tab of their own Player page (`openPageTab` in `src/lib/jump.ts`, picked up by
`useJumpTab`'s page id even when the page is not built yet) or scrolls to a card (`pickem-card`, `offseason-hub`). The old row of
buttons is now an "Explore" grid with a line on each (`Explore` in `src/pages/Games.tsx`); "Start a live game" stays a button above it.

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
- Older panels' look (2026-11-26): `DataTable`'s phone cards put the place, the name and the sorted column's number (display font,
  not the dot-matrix `font-led`) on one line, with the other stats in two columns; long panel notes show three lines with More/Less
  (`src/components/Hint.tsx`, in `Panel` and `PanelGroup`); the classic markup's numbers use the site font with tabular figures
  (`--font-mono` points at the sans in `legacy-shadcn.css`) and grid cells are rounded tiles; the classic text and panel notes no longer
  use " -- " as a dash (colons, or commas around a pair).
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
The race math (`raceWin`, `deuce` in `src/lib/race.ts`) and the live odds' pre-game share (`shareFor` in live.ts) keep their answers
(bounded tables), and the deuce loop stops once settled: a game page used to freeze about 3 s on a phone re-running them (the game
summary's work went from 692 ms to 36 ms, 2026-11-26). The heaviest remaining first-visit work is the classic win-share weights fit
(`computeWinSharesWeights`, about 100 ms, cached after the first time).
Avatars use 160px WebP copies (`public/photos/sm`, `playerThumbUrl`); run `scripts/photo-thumbs.sh` after adding a photo. The league
data is fetched with a plain request (`fetchPublic` in `src/lib/cloud.ts`) while the database library loads.

## Saving over the cloud

"Overwrite the cloud with mine" and the live-game save that takes friends' baskets both keep clip reviews (by key) and replay flags
(by id) that the cloud has and the device's copy lacks (`keepCloudMarks` in `src/lib/keepCloudMarks.ts`), and the editor's screen
takes them too, so an older copy on another phone cannot wipe them (11 reviews were lost that way on 2026-11-26). A review deleted on
one device can come back if another device saves over it; that trade was chosen on purpose.

## Security

- Content Security Policy (`CSP` and the `security-meta` plugin in `vite.config.ts`): a meta tag in built pages only (GitHub Pages
  cannot send headers; the dev server needs inline scripts). Scripts only from the site, YouTube's player API and Cloudflare's visitor analytics (which
  Cloudflare adds to intel.poolean.net itself); data only to Supabase, the video bucket, R2 uploads (`*.r2.cloudflarestorage.com`),
  open-meteo and cloudflareinsights.com; pictures and videos from any https host. A new host the
  page talks to must be added there or the live site blocks it (`src/lib/csp.test.ts` checks the known ones). No inline scripts in
  `index.html`: the theme boot is `public/theme-boot.js`. Crawled clean on intel.poolean.net on 2026-11-26.
- The publishable Supabase key is public by design. Every table has row level security: league data and snapshots are written only by
  accounts in `admins`; votes, goals, picks and RSVPs only through their phone-key functions; push tables and private labels are
  closed to visitors. The `league_state_alerts` trigger function is not callable through the API.
- The `live-score` function takes actions from anyone with no sign-in or code (by design, so friends can score; Adam's Poolean app
  posts to it too). Supabase's leaked-password check is off (a dashboard setting, Authentication, the editor's account).

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
(`src/components/GameReplay.tsx`, `src/lib/replay.ts`): every shot in order on one court with a net at each end (Team A shoots at
the bottom net, Team B at the top one; both share the whole court, each spot measured from the team's own net, so long shots reach past
halfway) (filled for a make, a ring for a miss, team
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
Win chance added, every play (asked 2026-11-27; `src/lib/wpaPlays.ts`, card `src/components/WinChancePlays.tsx` on the Leaderboard
Overview, a line in the Player page's "Win chance added" tab): the win chance from `possessionOdds` (shotChoice.ts, knows who has the
ball, first to the game's target, win by 2, the league's trip rates, even teams, no pre-game read), applied to every play from
`playValues` in video-time order with the free throws. Splits like Points added: shooter 65/35 with the passer, the defenders (and a
blocker) take the other side of the shot, an in-bounds miss is valued at the usual miss (`keep2`/`keep3`) and the rebound settles the
rest (credited only to the rebounder, so it counts once), a live-ball turnover to who lost it and the other side to who forced it, free
throws' points to the shooter. Only games with every play's video time count. `wpaPlays.test.ts` checks the credits add back to the
game's whole win-chance climb. On 2026-11-27, 6 games: Evan +101, Ben +59, Adam +58; Alex went from +29 on baskets only to -30 and Zach
from +3 to -40, mostly turnovers.
Clutch squared (asked 2026-11-27, "weighted by stakes"; moved onto the every-play model the same day): `clutch2` on
`winChancePlays`' rows (wpaPlays.ts). Each credit adds its share of the play times the play's whole swing (`d * |whole| * 100`), so the
sign stays with the play (a turnover at game point takes a lot away) and a shared play is not squared smaller; a 30-point swing is 9
clutch points and counts 36 times a 5-point one. Also `bigPlays` (swings of `BIG_SWING` 0.15 or more their team's way, with them in the
play) and `biggest`. Card `src/components/ClutchSquared.tsx` on the Leaderboard Overview and a line in the Player page's "Win chance
added" tab. On 2026-11-27: Evan 8.5, Adam 6.8 ... Viraj -7.1.
Form rating (asked 2026-11-27, DARKO-style; `src/lib/form.ts`, `src/components/FormRating.tsx`: a card on the Leaderboard Overview and a
chart on the Player page's Overview): each part of Points added per game (shots, passes, turnovers, offensive rebounds, defense, from
`pointsAdded(state, { only })` per filmed game) followed with a Kalman filter (`filter`): start at the league average with the talent
spread as the uncertainty, each game moves it by spread^2 / (spread^2 + noise^2), noise per part measured from the games (within-player
variance). Until `FORM_MEASURE_AT` (20) filmed games the spread is noise / sqrt(`PRIOR_GAMES` 8), since early measured spreads predicted
worse (strict check 20.4 against 16.6); from then each part's measured spread (method of moments, floored). `DRIFT` 0 (recency weighting
was slightly worse on 3 nights; recheck at 20). Range is 1.28 sd (about 80%). Strict check on 2026-11-27 (each night predicted from
earlier nights only, 43 player-games): 16.3 against 16.8 for the props' lean-by-3-games average (squared miss); `src/lib/form.test.ts`
reruns it with live data. Shown only; it feeds no prediction yet (the pre-game model waits for about 100 games).
Who's improving (asked 2026-11-27; `src/lib/improving.ts`, `src/components/Improving.tsx`): each player's form rating now against
before their last `LATELY` (3) games, and the part (`FormPoint.parts`) that moved most; players need more than 3 filmed games. A card on
the Leaderboard's Trends tab, and a closed "What the numbers say" fold (top 3) on the Most Improved (this season) ballot card. On
2026-11-27 Adam led (+0.5, mostly defense).
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
- Game page kept short (2026-11-26): the score card holds the pre-game call and the summary lines; on the Shots tab only the replay is
  open, and Was that run real?, the Shot Log and Other Events fold (`Panel folded`, a `<details>`), which took the tab from about 10,000
  to 2,300 px on a phone.
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

## Game drama rating (2026-11-27)

`src/lib/drama.ts`, `src/components/Drama.tsx`: each finished game with 4+ baskets scored by the excitement index, the total of every
basket's swing in win chance from `oddsTimeline(game, ballRates(state))` (shown times 100: "Drama: 190"), plus the winner's lowest
chance (`comeback`, "came back from a 4% chance" at 30% or under), lead changes (2+) and `lateDoubt` (the winner at 60% or under in the
last quarter of the baskets). On the game page under the summary lines (with its rank), "Game of the night" on the night recap, and
"Most dramatic games" in the Hall of Fame. On 2026-11-27 the top game was July 29's comeback from 4%.

## Your night, graded (2026-11-27)

`src/lib/nightReport.ts`, `src/components/NightReport.tsx` (under At a glance on the Player page; "Your night" on your own page) and a
"Next up for you" step: a player's last filmed night. The grade is where their Points added a game that night falls among every
player-night on record (`GRADES`, A+ for the top tenth down to D; no F), shown once there are 5 player-nights. Also their record and points
that night, the best play (as shooter or passer, with video) and one to fix (as shooter or who lost the ball), both in the film viewer
(`PlaysToWatch`), the form rating before and after the night, and a link when they played in the game of the night (drama.ts). The game
alerts carry no grade: a push subscription has no player attached.

## What if (2026-11-27)

`whatIfs` on `oddsTimeline` (`WhatIf`, `biggestWhatIfs`), the "What if" section on the game page's Odds tab (`WhatIfs` in
`src/components/OddsTimeline.tsx`): for each play, Team A's chance right after it as it happened and had it gone the other way, the
moment only (the rest of the game cannot be known). With the odds that know who had the ball (games with every play in order): a make
missing becomes the defense's ball, a miss going in the other team's ball after a score, a turnover undone the same team's ball, each
with this game's trips as they stood. Otherwise baskets only, and a missed basket leaves the score-only odds where they were. The five
biggest flips are listed (2+ points of win chance), with Watch links. `src/lib/whatIf.test.ts`.

## Season teams

`src/lib/seasonTeams.ts`, page `#/games/teams` (`src/pages/games/SeasonTeams.tsx`, a Games home button and in search). Shown to everyone
since 2026-11-26 (`SEASON_TEAMS_PUBLIC` in `src/lib/visibility.ts`; set it to false to hide every season-team surface from visitors again,
which `forVisitors` in App does by dropping `seasonTeamSets`). Visitors see the Games home button once a set exists. Teams that exist
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

## Draft lottery night (2026-11-26)

`src/lib/draftLottery.ts`, card `src/pages/games/DraftLottery.tsx` at the top of the Season teams page while a set is drafting and no pick
is made. The editor draws the first round's order (even by default, one ball each, asked 2026-11-26; or weighted: the weakest captain by
power ranking holds n balls down to 1 for the strongest), each pick drawn without putting balls back (`crypto.getRandomValues`), with every team's exact odds per pick
(`pickOdds`, every order gone through). Saved as `set.lottery` (order, balls, `revealed`), then revealed on everyone's phone one pick at
a time, last pick first; phones refresh every 4 s meanwhile. The teams are only reordered on the last reveal (the snake follows
`set.teams` order), and until then the draft board is hidden and the `season-draft` function (version 2) refuses picks. "Draw again"
and "Call off the lottery" before the first reveal. The order sits in the public league data from the draw, so a curious friend could
read it early.

## Trade offers between captains (2026-11-27)

Rules in `src/lib/seasonTrades.ts` (no imports: the `season-draft` function, version 3, runs a byte-for-byte copy,
`supabase/functions/season-draft/seasonTrades.ts`, checked by `seasonTrades.test.ts`); card `src/pages/games/Trades.tsx` under the
standings once the draft is done (current set only). A captain with their link (`savedCaptainLink`) offers up to `MAX_SIDE` (3) of
their players for up to 3 of another team's (captains stay; `MAX_OPEN` 4 open offers a team) through the function's `offer` action;
the asked captain uses `respond` (accept or decline), the offering one `withdraw`. An accepted trade waits for the editor: "Approve the
trade" re-checks it and moves the players with `movePlayer` dated today (so earlier nights stay with the old team), "Turn it down"
leaves everyone where they are. Saved in `set.offers`, shown to everyone with each status. The editor's captain links (`CaptainLinks`)
sit in the card after the draft, worded for trades.

## Stat questions in search (2026-11-27)

`src/lib/statAnswers.ts`, shown first in site search with a light bulb: single-game records ("most points in a game", "assist record",
from `recordBook`), career leaders ("who has the most 3s", "career rebounds"; box-score stats from filmed games), most wins and games
(every result, old site included), longest streaks (overall or a named player's), and a named player's best game, record and averages
("Ben's best game", "adam record", "evan average"). Plain word matching on stat words and player names; a question it does not
recognise gets no answer and search works as before. Each answer opens its game, player or the Hall of Fame.

## Film room (2026-11-27)

`src/lib/filmRoom.ts`, `src/components/FilmRoom.tsx`: plays to watch to learn and adjust, valued by Points added (`playValues` in
`epa.ts`, the same model and league rates as `pointsAdded`; a shot's value is what it left the trip worth less `ep`, a live-ball
turnover costs `ep`). Only plays with a video time are listed. A game page's "Film" tab (filmed games with video): for each team, what
worked and what did not (top and bottom by value, at most two of the same kind of play in a list), "Went in" / "Did not" (the kinds of
shot with the most and fewest points per shot, 3+ shots a kind and 0.3 apart: drives, moves, catch and shoot, held, heaves, open,
heavily contested, 2s, 3s) and "What hurt them" (the other team's best kind). The Player page's "Film" tab: their own best plays (as
shooter, or passer on a make) and plays to fix, stops and shots scored on them on defense, "How <name> got beaten" (`beatenBy`: every
shot where the shooter got past them, by shooter and how, with Watch all), their shot kinds (5+ a kind), and "Study an opponent" (both
directions, points per shot and the plays). Plays are plain sentences (`src/lib/playWords.ts`: "Zach hits a 3 off Ben's pass after getting past Ian.", "Ian blocks Ben's drive.",
"Zach misses a 3 wide open. It goes out of bounds."; no "good"/"no good" verdict, asked 2026-11-27) with
a small court showing the spot (`spot`, the shot's `shotLocation`).
Every play opens in the film room's own viewer (`FilmViewer`): from the play's short cut when one exists, else the recording, 4 s before
to 6 s after the logged moment (the end of its short cut; 3 s cut plays off, 2026-11-27), muted autoplay, 1x/0.5x/0.25x, Loop, previous/next and "Watch all" (a list back to back), "Send this
play" (`#/games/film/<game>.<play>`, `src/pages/games/FilmPlayPage.tsx`, share sheet or copied link) and notes. While open it stays pinned on
every screen size (asked 2026-11-27), just below the site header and the Player page's pinned tab row (`useStickyTop`), slimmed down while
pinned: the video at most 30% of the screen's height, a two-line caption, notes behind a "Notes" button. Notes (`src/lib/filmNotes.ts`, `supabase/filmNotes.sql`): up to 280 characters on a play, signed with
the phone's "Who are you?", owned by the phone (`add_film_note`, `delete_film_note`; 40 a day per phone; the play must exist in the league
data), shown to everyone, backed up nightly. "Film before you play" (`src/components/PregameFilm.tsx`, `scoutGame`) on both live screens
until the first basket: each player's go-to kind of shot (5+ shots, not 2s/3s/open/contested) with two of their makes of it to watch.

## Season awards voted by the players (2026-11-27)

`src/lib/awardVote.ts`, page `#/games/awards` (`src/pages/games/AwardVote.tsx`: `AwardsPage`, the Games home `AwardsCard`, an Explore
tile, search, a "Next up for you" step while voting is open, and "Voted by the players" in the Hall of Fame). The editor opens a ballot
(`state.awardBallots`, newest last: label, every award Poolean had (asked 2026-11-27), in reveal order `worst-duo` (Worst Duo),
`best-duo`, `teammate`, `mip-yoy`, `mip-season`, `clutch`, `dpoy`, `teams`, `best-player`, `mvp`. Kinds (`AwardDef.kind`): single;
`teams`, one ranking of players whose places come from `places` (instant runoff for place 1, that player taken off every ballot, again for
place 2...; 1 to 3 the first team, 4 to 6 the second, `teamsOf`); and `duo`, a ranking of pairs `pairId` ("a|b", ids sorted; tap two
players to rank a pair, `DuoBallot`), which `cast_award_vote` checks (two different candidates, neither the voter, sorted with
`collate "C"` to match JavaScript's sort, checked live in a rolled-back transaction 2026-11-27); what each rewards is
written once in `src/lib/awardText.ts`, shown on the ballot, the reveal and last season's results: MVP counts attendance, Best Player is
peak ability without it, asked 2026-11-27; candidates frozen at the start: players
with `MIN_GAMES` (5) games this season, at least 3). Ranked choice (asked 2026-11-27): each player ranks as many candidates as they like
per award from their own phone ("Who are you?"; tap in order, tap again to take out, `toggleRank`; saved after every tap), never
themselves, and can change it while voting is open. The winner is found by instant runoff (`runoff`: a majority of the ballots still
counting wins, else everyone tied for the fewest is knocked out and those ballots move to their next choice; a ballot with nobody left
stops counting; a tie it cannot break is shared). The reveal shows the final round's counts and "How the count went" (`roundsInWords`). The editor closes voting, then "Reveal <award>" one at a time, MVP last ("Hide the
last award again" undoes one; revealing always closes voting; "Reopen voting" only before the first reveal). Phones refresh every 4 s
while open or during a reveal (`revealing`, also in useCloud). Each revealed award shows the winner, the vote split
and what the numbers had (`numbersPick`, the award race leader for the same key; `verdict`). A secret ballot (`supabase/awards.sql`):
`award_votes` has row level security and no policies, so visitors cannot read it, even through the backup's anon key (not backed up);
`award_vote_counts` returns voters, ballots per award and every ranking of revealed awards only; `my_award_votes` this phone's own;
`cast_award_vote` (a `ranking` jsonb array: distinct candidates, not the voter) returns ok, closed, taken (another phone already votes as that player, or this phone already voted as someone else) or
no. Checked on 2026-11-27 inside a rolled-back transaction on live data: every rule held and nothing was left behind.

Last season's voted awards (`src/lib/pastAwards.ts`, `src/components/PastAwards.tsx`, under this season's vote on the Season awards page,
and in the Hall of Fame's "Voted by the players" board, which replaced the MVP-only board): Summer 2026 was voted in Adam's Poolean app,
where each ballot's top three scored 3/2/1 and a points tie went to attendance. Only the final points are here (`awards` in
`src/data/poolean-seasons.json`); the ballots are private in Poolean's `award_votes` (admin or the voter only), so they cannot be re-counted.
First and second team are one combined vote (places 1 to 3 and 4 to 6). The user chose to keep instant runoff for this site's own vote
(2026-11-27) even though Poolean moved to points. Clutch was corrected from Phillip to Zach on 2026-11-27 in both
`poolean-seasons.json` and `legacy-core.ts`: 7 to 7, and Poolean's re-tally (its docs/STATE.md, 2026-08-24) gave it to Zach on
attendance, 15 parties to 4, the winner announced.

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
  (version 6) adds up to two milestones from the game to its "Final" alert, using a byte-for-byte copy of the file and
  `old-results.json` (`node scripts/old-results.mjs` after the old results change; `milestones.test.ts` checks both).

## Play-by-play, guard plan, NBA comparisons, Play of the Year, goals, close-game alerts (2026-11-26)

- Play-by-play (`src/lib/playByPlay.ts`): a line under the score on the game video for every logged shot and steal with a video time
  ("Zach hits a 3 off Ben's pass.", worded by `src/lib/playWords.ts`, shared with the film room), shown `SHOW` 4 s from its moment; same switch as the score ("Score and play-by-play on
  the video").
- Who should guard whom (`src/lib/guardPlan.ts`, `src/components/GuardPlan.tsx`, both live screens until the first basket): for each
  team, the assignment that saves the most points, from "Who stops whom" pairs (leaning toward zero by `LEAN` 6 shots; pairs that never
  met use the defender's overall rate at half weight), weighted by each shooter's shots a game, every ordering tried. Only shown when at
  least one pair has 4+ shots. A suggestion; sets nothing.
- Plays like (`src/lib/nbaComps.ts`): eight traits measured against the league (spreads, clipped), matched to hand-described NBA
  players by angle, no two players sharing one unless that leaves a player under `WEAK` 0.3 (then nothing shows). Needs 3 games and 15
  shots. On the At a glance card ("Plays like: ...") and the trading card.
- Play of the Year (`src/lib/playOfYear.ts`, page `#/games/poty`, `src/pages/games/PlayOfYear.tsx`, a Games home button, a home card
  while a round is open or for 3 weeks after the final, search, Hall of Fame): the editor starts a bracket of the 16 (or 8) best
  shareable plays by `bestClips` order (never rough, never stills), saved in `state.playOfYear` (seeds frozen). Live by default (it
  will likely be done together at a party): one matchup at a time in bracket order, the editor opens it (`openMatch`), phones vote and
  see how many votes are in, and "Close voting and show the winner" reveals the split to the room (`closed`; "Reopen the last
  matchup" undoes a mistaken close). Phones refresh every 4 s while a live vote is going (`liveVoting`: a matchup open, or one opened
  or closed in the last two hours, `lastAt`), votes every 3 s. The other mode, over days, opens a round every 3 days from `startAt`
  and shows counts once a phone has voted. Votes: `poty_votes`, one per phone per match, only through `cast_poty_vote`
  (`supabase/poty.sql`), which checks the newest bracket, the seed, and the open matchup (live) or the open round (over days). More
  votes wins; a tie goes to the higher seed; votes for a play not in the match are ignored.
- Summer goals (`src/lib/goals.ts`, `src/components/SummerGoals.tsx` under At a glance): up to two goals a season, set from the player's
  own phone ("Who are you?" is that player); `season_goals`, only through `save_season_goal` (`supabase/goals.sql`); the first phone
  to set a player's goal owns that player's goals for the season. Progress from that calendar year's games; averages and percentages
  need `min` games or shots to count as done. Hidden for other players when none are set.
- Close-game alerts: the `league_state` trigger also pings `game-alerts` (version 6) with `{close}` when a live game's baskets grow;
  one "close game" alert per game when the leader is within 2 of the other team and within 2 of `liveTarget` (`push_sent` kind
  `close`). Never for test games. Checked live with a call (sends nothing with no live game); delivery to a phone not yet seen.
- Backups also save `poty_votes` and `season_goals`.

## Announcer mode and the story picture (2026-11-26)

- Announcer (`src/components/Announcer.tsx`, wording in `src/lib/announcer.ts`): an "Announcer" button on both live screens (above the
  editor's board, so it still calls the final after the game stops being live). The phone's own voice (speechSynthesis) calls each new
  basket and the score ("Zach, three. Team A leads 9 to 7."), "Game point, Team A" when a two would end it, a basket taken back, and the
  end once. Off on every visit (phones only allow speech a tap started; the tap says "Announcer on"); keeps the screen awake while on
  (Wake Lock). Speech errors are swallowed so they cannot break the live screen.
- Story picture (`drawNightStory` in `src/lib/shareCard.ts`, "Story picture" on the night recap): 1080x1920 for Instagram stories, with
  everything kept out of the top and bottom 250 px Instagram covers. It shows the play of the night's still across the top (only
  drawable on the live site, where the bucket's CORS allows it), the player of the night (MVP with a box score, else the top scorer),
  every result and the address. Shared as a file, else downloaded.

## Does the weather change the game? (2026-11-26)

`src/lib/weatherGame.ts`, card `src/components/WeatherCard.tsx` on the Leaderboard's Trends tab. Each filmed game gets the weather of its
hour (`startedAt` for live-scored games, else the night's 5 to 9 PM average; past recordings have no start time) from
`src/data/night-weather.json`, which `scripts/night-weather.mjs` fills from Open-Meteo (archive after about five days, the forecast
service's recent past before that, refetched from the archive later) and `.github/workflows/night-weather.yml` commits every morning.
The archive host is blocked in cloud sessions, so run the workflow from the Actions tab rather than the script here. Games split at the
median temperature (warmer against cooler) and at half cloud cover (sunnier against cloudier): field goal percentage, points per shot,
share of 3s; a gap counts only past twice its standard error with 2+ nights a side. Players at 10+ shots each side, leaned toward no
difference by 20 shots. Visitors see it from `MIN_NIGHTS` (6) filmed nights; the editor sees a preview before that. On 2026-11-26 only 3
nights were filmed (the old site's results have no scores), so it says nothing yet. `src/lib/heat.ts` is unrelated (heat-map cell tints).

## Live win probability

`src/lib/live.ts`: an exact race to the target (win by 2) from the pre-game read (`predictRealMatchup`, fitted on the old site's 60 results:
power rankings, extra player, history together and against) and the baskets so far (the read counts as 20 baskets, `PRIOR_SCORES`). The live
odds start from 0.7 of the read's lean (`PREGAME_WEIGHT_LIVE`). At 0-0 the live odds equal that, so every result on record tests it.
Checked 2026-11-24 on all 44 games with a pre-game call (35 unfilmed results at their opening moment, 9 filmed games at every moment,
each game counted once, calls from earlier nights only): 0.7 is best (log loss 0.582; 0.5 gave 0.591, the full read 0.611), flat from 0.6
to 0.8. The 9 filmed games alone pointed to 0.5 or less, but they come mostly from the read's two worst nights. Over all its calls the read
is right 73% of the time, better late in the season (78%) than early (68%), and too sure at the top (its 80%+ calls won 67%). A team-specific
point mix and moving the odds by points did not help. Replays use the odds with the ball (asked 2026-11-27): `src/lib/liveBall.ts` keeps the pre-game read at `PREGAME_WEIGHT_LIVE` and learning
from the game, but races by trips with the ball (each team's trip scoring rate set by the read's gap, then moved by this game's trips,
leaning on the read by `PRIOR_TRIPS` 50). `oddsTimeline(game, ballRates(state))` uses it for any game with every play in order (shots,
live-ball turnovers, free throws all with video times), so the Odds tab (says so in its header), the score on the game video and the game
summary's biggest basket (`swingOf`, now read off the same timeline) agree; other games fall back to the score-only odds. Checked against
who won at every play of the 6 complete games: log loss 0.438 against 0.451 (0.442 against 0.450 at baskets alone), better in 5 of 6,
PRIOR_TRIPS 25 to 100 all better; `src/lib/liveBall.test.ts` reruns it with live data and says what to do when it fails. The live
screen keeps the score-only odds (a live game logs baskets only, so there are no trips to learn from; that variant is untested).
`src/lib/liveReplay.test.ts` reruns the combined check with live data and fails if
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
