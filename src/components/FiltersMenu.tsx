import { SlidersHorizontal } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { filmedGameCount, OUTLIERS_OFF_AT } from "@/lib/filters"
import { defaultToggles, type Toggles } from "@/lib/toggles"
import { currentRules, ruleChanges } from "@/lib/rulebook"
import { formatDateDisplay } from "@/lib/format"

const ROWS: { key: "imbalanced" | "outliers" | "pastSeasons"; label: string; hint: string }[] = [
  { key: "imbalanced", label: "Include imbalanced games", hint: "Count uneven teams, like 3 against 2. Off by default because an uneven game is not a fair test of anyone." },
  { key: "outliers", label: "Include outlier games", hint: "On: every game counts. Off: once a player has 4 games, their unusually good or bad ones are left out of their averages, worked out again each time a game is entered. Records, best games and personal bests always count every game." },
  { key: "pastSeasons", label: "Include past seasons", hint: "Count games from before this season too. Off shows this season, plus a few recent games while the season is young." },
]

// The filters every page follows: standings, awards, the Leaderboard, player pages and the deep dives all count the same games.
// Analyses about team size itself (By format, the bigger-team rule) always use every game.
export function FiltersMenu({ toggles, setToggles }: { toggles: Toggles; setToggles: (t: Toggles) => void }) {
  const d = defaultToggles()
  const changed = (toggles.imbalanced !== d.imbalanced ? 1 : 0) + (toggles.outliers !== d.outliers ? 1 : 0) + (toggles.pastSeasons !== d.pastSeasons ? 1 : 0) + (toggles.currentRules ? 1 : 0)
  // Offered once Poolean's rulebook has changed (rulebook.ts).
  const rulesFrom = ruleChanges().length ? currentRules()?.from : null
  return (
    <details data-menu className="relative max-sm:static">
      <summary className={`${buttonVariants({ variant: "outline", size: "sm" })} cursor-pointer list-none gap-1.5 [&::-webkit-details-marker]:hidden`}>
        <SlidersHorizontal aria-hidden className="size-4" />
        <span className="max-sm:sr-only">Filters</span>
        {changed > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{changed}</span>}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 max-sm:left-4 max-sm:right-4 max-sm:w-auto max-sm:max-h-[75vh] max-sm:overflow-y-auto rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg">
        <div className="mb-1 font-semibold">Which games count</div>
        <ul className="flex flex-col gap-3">
          {ROWS.map((r) => (
            <li key={r.key}>
              <label className="flex min-h-10 items-center justify-between gap-3">
                <span className="font-medium">{r.label}</span>
                <Switch checked={toggles[r.key]} onCheckedChange={(v) => setToggles({ ...toggles, [r.key]: v })} />
              </label>
              <p className="text-xs text-muted-foreground">
                {r.hint}
                {r.key === "outliers" &&
                  (filmedGameCount() < OUTLIERS_OFF_AT
                    ? ` On by default until there are ${OUTLIERS_OFF_AT} filmed games (${filmedGameCount()} so far), then off by default.`
                    : ` Off by default now that there are ${OUTLIERS_OFF_AT}+ filmed games.`)}
              </p>
            </li>
          ))}
          {rulesFrom && (
            <li>
              <label className="flex min-h-10 items-center justify-between gap-3">
                <span className="font-medium">Only games under the current rules</span>
                <Switch checked={!!toggles.currentRules} onCheckedChange={(v) => setToggles({ ...toggles, currentRules: v })} />
              </label>
              <p className="text-xs text-muted-foreground">
                Poolean's rulebook last changed on {formatDateDisplay(rulesFrom)}. On: the Leaderboard and player pages count only games since then. The Games pages always show every game.
              </p>
            </li>
          )}
        </ul>
        {changed > 0 && (
          <button type="button" onClick={() => setToggles(defaultToggles())} className="mt-3 min-h-10 w-full rounded-lg border text-sm font-medium hover:bg-muted">
            Back to the default filters
          </button>
        )}
      </div>
    </details>
  )
}
