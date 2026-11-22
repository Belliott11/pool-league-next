import { Panel } from "@/components/Panel"
import { Terms } from "@/components/Terms"
import type { PooleanState } from "@/lib/types"
import { writtenNote, writtenRead } from "@/lib/writtenReads"

// The written read for one player, the same one their Advanced reads card shows. Nothing shows for a player without one yet.
export function PlayerRead({ state, pid }: { state: PooleanState; pid: string }) {
  const r = writtenRead(pid)
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
