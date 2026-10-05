import { Newspaper } from "lucide-react"
import { useMemo, useState } from "react"
import { playerName } from "@/lib/players"
import { useLabeledState } from "@/lib/labelsContext"
import { usePublishedStories } from "@/lib/published"
import { previewStories } from "@/lib/storylines"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

const SHOWN = 3

// A few storylines going into the next night: streaks, who is hot, records within reach, rivalries.
// Written from the stats, so it needs a few weeks of games before it has anything to say. Only the first few show
// at first so the game list stays near the top of the page.
export function GoingIn({ state, update }: { state: PooleanState; update?: Update }) {
  const labeled = useLabeledState(state)
  const written = useMemo(() => previewStories(labeled, (id) => playerName(state, id)), [labeled, state])
  const stories = usePublishedStories(state, update, "going", written)
  const [all, setAll] = useState(false)
  if (stories.length === 0) return null
  const shown = all ? stories : stories.slice(0, SHOWN)
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="Going into the next night">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <Newspaper aria-hidden className="size-4 text-accent" /> Going into the next night
      </h3>
      <ul className="flex flex-col gap-2 text-sm">
        {shown.map((x) => (
          <li key={x} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
      {stories.length > SHOWN && (
        <button type="button" className="self-start text-sm font-medium text-accent hover:underline" onClick={() => setAll(!all)}>
          {all ? "Show less" : `Show ${stories.length - SHOWN} more`}
        </button>
      )}
    </section>
  )
}
