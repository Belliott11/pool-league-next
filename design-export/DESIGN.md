# Poolean Intel design style, for reuse

A sport-scoreboard look: blue-tinted dark neutrals, one red accent, wide heavy type, and flip-dot numbers. Nothing here needs a framework.

## What is in this folder

| File | What it is |
| --- | --- |
| `tokens.css` | Colors, fonts, cards, buttons, chips and motion. Link it and you have the look. |
| `flipdots.js` | Flip-dot digits. `<span data-flip="42"></span>`, then `flipDots.init()`. |
| `shot-loader.svg` | The basketball shot loader. Inline it in the page (not as an `<img>`) so the net and backboard follow the text color. |
| `logo.svg` | The ball-over-water logo, also the favicon. |
| `demo.html` | A personal-site layout using all of it. Serve the folder (`python -m http.server`) and open it. Opening the file directly blocks the script. |

## The look in six rules

1. **One accent.** Red `#c8102e` (dark mode `#ff4d5e`). It marks the leader, the selected thing and the main button. Change `--accent` and everything follows.
2. **Two sides.** Blue `#1d4fd8` and red from the logo ball. Use them for any "this versus that", such as skills versus interests or before versus after.
3. **Meaning colors stay fixed.** Green is good, rose is bad, gold is first place. Never use them as decoration.
4. **Type.** Anybody (wide, heavy) for headings and big numbers, Hanken Grotesk for text. Titles are caps with wide spacing. Body text stays plain and never goes below 16px.
5. **Neutrals have a hue.** The grays lean blue, so the page feels like an arena at night, not a template.
6. **Cards for things, not for everything.** A card is a hairline ring and a small caps title. Lists inside cards are plain rows with a divider.

## Motion

- Cards rise in one after another, bars grow from their baseline, buttons press to 97%.
- Numbers use flip-dots, and only the dots that change flip.
- The loader is a basketball that spins up, drops through the net and starts again.
- All of it switches off for people who ask for reduced motion. Keep new motion inside the same `prefers-reduced-motion: no-preference` block.

## Writing

Specific, plain and a little dry. Say what a thing is and what it does. No em dashes.

## Moving it into a real site

- **Plain HTML:** copy the folder, link `tokens.css`, and import `flipdots.js` as a module.
- **React or Tailwind:** paste the `:root` variables into your global stylesheet and map them in your theme (`--color-accent: var(--accent)`). The Poolean Intel repo has the same tokens in `src/index.css` and the digits as a component in `src/components/FlipDigits.tsx`.
- **Make it yours:** swap the logo, pick your own accent, and keep the structure. The two side colors can stay or become a pair that fits you.

## Fixing a lame personal site, in order

1. Replace the font stack and the colors with `tokens.css`. That alone changes the feel.
2. Write a hero with one big line and one plain sentence under it.
3. Show three to five real numbers in flip-dots (projects, years, something specific to you).
4. Make projects cards with a single line each and a result, not a list of tools.
5. Add the loader or a favicon so the site has one memorable thing.
