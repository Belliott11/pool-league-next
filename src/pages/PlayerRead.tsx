import { Panel } from "@/components/Panel"
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
    </Panel>
  )
}
