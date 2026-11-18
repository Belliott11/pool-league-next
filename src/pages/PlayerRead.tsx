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
      <div className="flex max-w-prose flex-col gap-2 text-sm">
        {r.text.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
      {r.workOn && r.workOn.length > 0 && (
        <div className="flex max-w-prose flex-col gap-1.5 text-sm">
          <h4 className="font-display font-semibold">Work on</h4>
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {r.workOn.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      <Terms texts={[r.headline, ...r.text, ...(r.workOn ?? [])]} open />
    </Panel>
  )
}
