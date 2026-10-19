# UI brief: what to reuse from Poolean Intel for a movie club site

Poolean Intel is a phone-first league tracker. Most of its UI ideas are about a small group of friends, a recurring night, and shared opinions, which is also what a movie club is. This lists what carries over, with the movie-club version of each.

## Stack and setup to copy as is

- React 19, Vite, TypeScript, Tailwind v4, shadcn-style components on `@base-ui/react`, `lucide-react` icons, `class-variance-authority` and `cn` for variants.
- Components in `src/components/ui`: button, card, dialog, input, select, switch, table, tabs, badge, avatar, separator. Start the new project from these.
- Hosting: static build on GitHub Pages, data in Supabase (one shared copy, an editor who can write, visitors who can read). Setup notes are in `docs/cloud-setup.md`.
- PWA: manifest, service worker, icons. Installs from the browser to a home screen with no app store.

## Look and feel

- **Tokens, not colors.** Every color is a CSS variable in `src/index.css` (background, card, muted, border, accent, plus pos, neg and gold for meaning). Light and dark are two sets of the same tokens. Do this first and everything else follows.
- **One accent that drives the palette.** Pick the accent and the supporting colors derive from it with `oklch(from var(--accent) ...)`. Five accent options are in a color menu. For a movie club, a single accent plus warm neutrals reads as a cinema.
- **Type.** A display face for scores and headings (Anybody, variable width) over a plain body face (Hanken Grotesk). Use a display face for ratings and titles and keep body text plain.
- **Meaning colors stay fixed.** Green for good, red for bad, gold for highlights, whatever the accent. For a club: gold for a winner or best pick.
- **Cards for objects, not for everything.** Standings and recaps are cards. Lists inside them are plain rows.

## Navigation and layout

- **Bottom tabs on a phone, top tabs on desktop.** Few tabs (Games, Leaderboard, Player, plus editor-only ones). For a club: Films, Ratings, Members.
- **Hash routes with real back behavior.** `#/games/game/ID` style routes, browser history works, scroll position restores. Visitors share links to a single screen.
- **Swipe between tabs**, with `data-no-swipe` to opt out on charts, tables and inputs.
- **Read-only by default.** Visitors never see edit controls. One signed-in editor makes changes. This keeps a small site simple: no accounts for members.
- **Sub-screens inside a tab** (game page, recap, stat entry) with a back arrow, not new top-level tabs.

## Components worth lifting

| Component | What it does | Movie club use |
| --- | --- | --- |
| Night recap and night preview | A card per date: who came, headlines about them, a share button | The week's screening: who came, what was watched, quick takes |
| Pick'em (`PickEm.tsx`) | Visitors vote on a winner before a game, no sign-in | Guess the group's rating before the meetup |
| Prediction scorecard | Saved pick, scored after the fact, labelled separately from backtests | "Who guessed the group's rating best" |
| Award race | Leaders in each award for this season, with minimum games | Best pick, harshest critic, most contrarian |
| Rivalries and head to head | Pairs who keep meeting, series record, last meeting | Pairs who disagree most on ratings |
| Attendance card | Share of nights each member came, last 5 nights | Who shows up |
| Next night card | Who is coming, even teams or not, regulars missing | RSVPs: who is coming, who usually does and hasn't answered |
| Records and "closest to a record" | All-time marks and who is chasing them | Highest rated, lowest rated, longest streak of 4-star picks |
| Share for the group chat | One tap copies the card as text | Same, for the group chat |
| TV scoreboard | Full-screen read-only board, sized in `vmin` | A "now showing" screen for a projector |
| Story list and headlines | Generated sentences about people, reviewed one by one | Funny one-liners about members' taste |

## Interaction polish that cost little

- **Loading:** a small tile-shuffle loader centered on the screen, in portal so tab animations don't move it. Swap the tile colors for the new palette.
- **Pull to refresh** on phones, off inside forms and the live screen.
- **Motion that answers an action:** cards rise in turn, rows settle one after another, bars grow from their baseline, scores bump when they change, one light sweep over the winner. All of it is off under reduced motion.
- **Press feedback:** buttons scale to 0.97 on press, switches spring.
- **Sync chip** for the editor: Saving, Saved, Offline kept on this phone, Will retry. Worth having if anyone edits on a phone with weak signal.
- **Empty states** say what is missing and what to do, with a small animated mark.
- **Accessibility floor:** visible focus rings, 44px tap targets, `role="status"` on live updates, text equivalents for charts and bars.

## Headlines, if the new site wants personality

- A review panel to approve or remove each generated line, a cap per kind so the loop ends, and a note of what was approved so new lines match.
- Private labels per member that headlines are written from, never shown to visitors. See `docs/adr/0001-labels-are-private.md`.
- Tone rules that matter: specific, deadpan, everyday; no invented facts that could be believed; no em dashes in text.
- It only pays off with a regular group and a few months of data. Skip it at launch.

## Process habits worth keeping

- **Glossary first.** `CONTEXT.md` fixes the words (Night, Visitor, Editor) before screens use them. Do the same for Film, Screening, Rating, Member before building.
- **Label what is predicted and what is measured.** The scorecard keeps saved picks apart from backtests. For ratings, keep "guessed before" apart from "rated after".
- **Test on a real phone on a real night** before adding anything.

## Suggested first build for the movie club

1. Tokens, fonts, tabs, cards, dark mode, PWA (a day).
2. Films tab: next screening card with RSVP, past screenings list.
3. Screening page: who came, group rating, one line per member.
4. Ratings tab: members' scores, taste overlap, award race.
5. Pick'em on the group's rating, then headlines once there is history.
