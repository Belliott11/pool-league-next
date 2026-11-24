import { SlidersHorizontal } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_TOGGLES, type Toggles } from "@/lib/toggles"

const ROWS: { key: keyof Toggles; label: string; hint: string }[] = [
  { key: "imbalanced", label: "Include imbalanced games", hint: "Count uneven teams, like 3 against 2. Off by default because an uneven game is not a fair test of anyone." },
  { key: "outliers", label: "Include outlier games", hint: "On: every game counts. Off: once a player has 4 games, their unusually good or bad ones are left out of their own stats." },
  { key: "pastSeasons", label: "Include past seasons", hint: "Count games from before this season too. Off shows this season, plus a few recent games while the season is young." },
]

// The filters every page follows: standings, awards, the Leaderboard, player pages and the deep dives all count the same games.
// Analyses about team size itself (By format, the bigger-team rule) always use every game.
export function FiltersMenu({ toggles, setToggles }: { toggles: Toggles; setToggles: (t: Toggles) => void }) {
  const changed = (toggles.imbalanced ? 1 : 0) + (toggles.outliers ? 0 : 1) + (toggles.pastSeasons ? 1 : 0)
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
              <p className="text-xs text-muted-foreground">{r.hint}</p>
            </li>
          ))}
        </ul>
        {changed > 0 && (
          <button type="button" onClick={() => setToggles(DEFAULT_TOGGLES)} className="mt-3 min-h-10 w-full rounded-lg border text-sm font-medium hover:bg-muted">
            Back to the default filters
          </button>
        )}
      </div>
    </details>
  )
}
