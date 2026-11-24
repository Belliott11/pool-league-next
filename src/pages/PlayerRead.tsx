import { useMemo } from "react"
import { Panel } from "@/components/Panel"
import { Terms } from "@/components/Terms"
import { advancedReads } from "@/lib/advancedReads"
import { isDefaultFilters } from "@/lib/filters"
import type { PooleanState } from "@/lib/types"
import { writtenNote, writtenReadFor } from "@/lib/writtenReads"

// The written read for one player, the same one their Advanced reads card shows. With Filters other than the default (or for a player
// with no written read yet) it is the read worked out live from `season`, which follows the Filters. Nothing shows for a player with too
// few games for either.
export function PlayerRead({ state, season = state, pid }: { state: PooleanState; season?: PooleanState; pid: string }) {
  const written = writtenReadFor(pid)
  const live = useMemo(() => (written ? null : (advancedReads(season).reads.find((x) => x.id === pid) ?? null)), [written, season, pid])
  if (!written && live)
    return (
      <Panel title="Advanced read" hint={isDefaultFilters() ? "Worked out live from the numbers. There is no written read for this player yet." : writtenNote(state)}>
        <p className="font-medium">{live.headline}</p>
        <dl className="grid max-w-prose gap-x-4 gap-y-2 text-sm sm:grid-cols-[6.5rem_minmax(0,1fr)]">
          {live.lines.map((l) => (
            <div key={l.label} className="contents">
              <dt className={`font-semibold ${l.tone === "good" ? "text-pos" : l.tone === "bad" ? "text-neg" : "text-muted-foreground"}`}>{l.label}</dt>
              <dd className="mb-2 min-w-0 sm:mb-0">{l.text}</dd>
            </div>
          ))}
        </dl>
        <Terms texts={[live.headline, ...live.lines.map((l) => l.text)]} />
      </Panel>
    )
  const r = written
  if (!r) return null
  return (
    <Panel title="Advanced read" hint={writtenNote(state)}>
      <p className="font-medium">{r.headline}</p>
      {/* The first paragraph shows; the rest of the report and what to work on open with a tap, to keep the page short. */}
      <div className="flex max-w-prose flex-col gap-2 text-sm">
        {r.text[0] && <p>{r.text[0]}</p>}
        {(r.text.length > 1 || (r.workOn?.length ?? 0) > 0) && (
          <details className="group/read">
            <summary className="cursor-pointer list-none font-medium text-accent [&::-webkit-details-marker]:hidden">
              <span className="group-open/read:hidden">Read the rest</span>
              <span className="hidden group-open/read:inline">Show less</span>
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              {r.text.slice(1).map((t, i) => (
                <p key={i}>{t}</p>
              ))}
              {r.workOn && r.workOn.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h4 className="font-display font-semibold">Work on</h4>
                  <ul className="flex list-disc flex-col gap-1.5 pl-5">
                    {r.workOn.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
      <Terms texts={[r.headline, ...r.text, ...(r.workOn ?? [])]} />
    </Panel>
  )
}
