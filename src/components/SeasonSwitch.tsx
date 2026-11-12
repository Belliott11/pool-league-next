import { carryNote } from "@/lib/season"
import type { Toggles } from "@/lib/toggles"
import type { PooleanState } from "@/lib/types"

// This season or all time, for every season stat on the page. The same setting as Include Past Seasons in the filters. Hidden until a
// season has been closed, since before then there is only one season.
export function SeasonSwitch({ state, toggles, setToggles }: { state: PooleanState; toggles: Toggles; setToggles?: (t: Toggles) => void }) {
  if (!state.currentSeasonStartedAt) return null
  const note = carryNote(state, toggles.pastSeasons)
  const pick = (all: boolean) => setToggles?.({ ...toggles, pastSeasons: all })
  const btn = (label: string, on: boolean, all: boolean) => (
    <button
      type="button"
      aria-pressed={on}
      disabled={!setToggles}
      onClick={() => pick(all)}
      className={`min-h-10 rounded-full px-4 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label="Which games the stats count" className="inline-flex self-start rounded-full border bg-card p-1">
        {btn("This season", !toggles.pastSeasons, false)}
        {btn("All time", toggles.pastSeasons, true)}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
