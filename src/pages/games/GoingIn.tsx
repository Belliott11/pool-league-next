import { Newspaper } from "lucide-react"
import { useMemo } from "react"
import { playerName } from "@/lib/players"
import { previewStories } from "@/lib/storylines"
import type { PooleanState } from "@/lib/types"

// A few storylines going into the next night: streaks, who is hot, records within reach, rivalries.
// Written from the stats, so it needs a few weeks of games before it has anything to say.
export function GoingIn({ state }: { state: PooleanState }) {
  const stories = useMemo(() => previewStories(state, (id) => playerName(state, id)), [state])
  if (stories.length === 0) return null
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4" aria-label="Going into the next night">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <Newspaper aria-hidden className="size-4 text-accent" /> Going into the next night
      </h3>
      <ul className="flex flex-col gap-2 text-sm">
        {stories.map((x) => (
          <li key={x} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
            <span>{x}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
