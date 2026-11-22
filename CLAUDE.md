# Working on Poolean Intel

Pool basketball league stats site. React 19, Vite, TypeScript, Tailwind v4. Live at https://belliott11.github.io/pool-league-next/,
deployed from `main` by `.github/workflows/deploy.yml`. League terms are defined in `CONTEXT.md`; use them.

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
- Video frames can only be read (stills, following) on the live origin: the R2 bucket's CORS allows only belliott11.github.io. Headless
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
from `clipId` in `src/lib/clipShare.ts`. Clip tiles have a Share button.

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

Placing a game inside a night's recording is done by hand (start and end as m:ss). Live games now save `startedAt`, `endedAt` and an `at`
time on each basket (the editor's in the site, friends' in the `live-score` function, version 4, which takes the phone's tap time when it
is within the last six hours). With a
recording's own start time (kept in original phone files, lost in exported copies) those would place games and baskets automatically;
not built yet. Finding game breaks from motion in the video was tried: right on one recording, wrong on one of two breaks on another,
so it is not reliable enough to place games.

## Speed

Avatars use 160px WebP copies (`public/photos/sm`, `playerThumbUrl`); run `scripts/photo-thumbs.sh` after adding a photo. The league
data is fetched with a plain request (`fetchPublic` in `src/lib/cloud.ts`) while the database library loads.

## Backups

`.github/workflows/backup.yml` saves the league data row, Pick'em votes and preseason predictions every night as a run artifact kept 30
days (Actions tab, "Back up league data", a run, Artifacts). It fails if the league data has fewer than 5 games or players. Private labels
are not in it (editor-only). To restore league data from one: ask the user first, insert the current row into `league_state_history`
as a snapshot, then write the backup's `data` back to `league_state` id 1, and verify the counts.

## Environment

- `.mcp.json` adds the Playwright browser MCP (`scripts/playwright-mcp.sh`) for testing pages, including the live site.
- Cloud sessions should use the "pool-league-next" environment: it allows the live site, Supabase, the R2 video host and the weather API,
  and runs `npm ci` on start.

## Ideas not built

- A custom domain on the R2 bucket, for caching and no rate limit (`r2.dev` is rate-limited). Needs a domain on Cloudflare.
