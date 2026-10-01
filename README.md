# Poolean Intel (next)

Vite + React + TypeScript + shadcn/ui rebuild of Poolean Intel, ported incrementally from the
static site in `dashboard`. First slice: Games list, Season Rates (table on desktop, cards on
mobile), and the Player header.

The stat formulas in `src/lib/stats.ts` are ported from `dashboard/app.js` with their logic
unchanged. Data comes from importing the JSON backup the classic site exports (Export All Data or
Save Backup); it is stored in this origin's localStorage.

    npm install
    npm run dev
    npm run build

Deploys to GitHub Pages from `main` via `.github/workflows/deploy.yml`. The security-review
workflow needs a `CLAUDE_API_KEY` repository secret.
