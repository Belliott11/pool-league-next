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
- Playback crop and follow only apply to backdrops narrower than 640px (`SMALL` in `ClipBackdrop.tsx`).
- Video frames can only be read (stills, following) on the live origin: the R2 bucket's CORS allows only belliott11.github.io and
  intel.poolean.net. Headless
  browsers run IntersectionObserver fine; the user's hidden preview pane does not.

### Short clip files

Every clip plays from its own ~1.2 MB file instead of seeking into a 150 to 280 MB recording. `npm run cut-clips`
(`scripts/cut-clips.mjs`) cuts each clip's stretch (`cutWindow` in `src/lib/clipCuts.ts`: 5 s before to 6 s after, or the editor's trim)
with ffmpeg, uploads it to the `pooleanintel` bucket under `clips/`, and lists it in `src/data/clip-cuts.json`. Clips not in the list
play from the full recording, so a new or re-trimmed clip works before it is cut. `.github/workflows/cut-clips.yml` runs it nightly
and commits the list; it needs the `CLOUDFLARE_API_TOKEN` repository secret (an R2 token with Admin Read & Write, since bucket-scoped
tokens only work with the S3 API). In a cloud session the same token is saved on the "pool-league-next" environment for
api.cloudflare.com.

### Share links and pictures

`npm run cut-clips` also saves a picture of each play (`clips/.../<name>.jpg`) and lists shareable clips in
`src/data/clip-shares.json` (never one that goes badly for someone). The build writes `clip/<id>.html` for each (the `clipPages` plugin
in `vite.config.ts`): the preview title and picture, then a redirect to `#/games/clip/<id>` (`src/pages/games/ClipPage.tsx`). Ids come
from `clipId` in `src/lib/clipShare.ts`. Clip tiles have a Share button. Every link that is sent (share buttons, link previews) uses the public
address in `src/lib/site.ts` (`https://intel.poolean.net/`; the clip pages' copy is `SITE` in `vite.config.ts`).

### Season trailer

The same script joins the season's 8 best plays (two per game at most, none rough) into `clips/trailer/season-<hash>.mp4`, no sound,
quick fades, and lists it in `src/data/trailer.json`; rebuilt only when the plays change. The Top plays card on the home page
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
sends it to the `live-score` function, version 6, action `review`) saves the moment it was tapped, an optional note and who flagged it,
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
History) holding every panel. "Jump to a panel" switches tabs through the `panel-section` event in `src/lib/jump.ts`.

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
  (`src/pages/games/HeadToHeadPage.tsx`: that record, then the filmed head-to-head card starting on the pair).
- The Filters menu has "Back to the default filters" when any filter is changed.
- Accessibility: every Leaderboard and Player tab, the Games home and search pass axe (WCAG 2.1 AA) in both themes. Mark thin samples
  with italics or a dashed border, never by fading (fading fails contrast).
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
