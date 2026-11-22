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
- Following (`src/lib/track.ts`): players are followed automatically from one tap; the ball by hand, a tap every half second. The ball is
  not visible on this footage, so do not retry automatic ball finding.
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

## Headlines and clips

`src/lib/headlineClips.ts` gives a headline a clip only when it knows who the headline is about and whether it is good or bad news for
them: the editor's mark (`state.headlineTones`, set from the clapperboard beside each headline, `src/components/HeadlineTone.tsx`),
else `src/data/headline-tones.json`. Clips are never reused across headlines shown together.

## Environment

- `.mcp.json` adds the Playwright browser MCP (`scripts/playwright-mcp.sh`) for testing pages, including the live site.
- Cloud sessions should use the "pool-league-next" environment: it allows the live site, Supabase, the R2 video host and the weather API,
  and runs `npm ci` on start.

## Ideas not built

- Follow whoever has the ball.
- A custom domain on the R2 bucket, for caching and no rate limit (`r2.dev` is rate-limited). Needs a domain on Cloudflare.
