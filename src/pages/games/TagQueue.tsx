import { useMemo } from "react"
import { tagQueue } from "@/lib/tagQueue"
import type { PooleanState } from "@/lib/types"

// Where to start tagging: each kind of missing tag across all filmed games, biggest pile first.
export function TagQueue({ state }: { state: PooleanState }) {
  const rows = useMemo(() => tagQueue(state), [state])
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing is missing a tag.</p>
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {rows.map((r, i) => (
        <li key={r.label} className="flex items-baseline gap-2 border-t pt-2">
          <span className="w-5 tabular-nums text-muted-foreground">{i + 1}.</span>
          <span className="min-w-0 flex-1">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted-foreground">
              : {r.count} in {r.games} {r.games === 1 ? "game" : "games"}. Feeds {r.feeds}.
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
