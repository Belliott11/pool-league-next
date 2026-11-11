import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { formatDateDisplay } from "@/lib/format"
import { findUnfilled } from "@/lib/unfilled"
import type { PooleanState } from "@/lib/types"

// Editors only: each filmed game and what it still needs for the newer stats. Opening a game is where either gets filled in.
export function UnfilledList({ state }: { state: PooleanState }) {
  const rows = useMemo(() => findUnfilled(state), [state])
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Every filmed game has its tip-off matchups and contest levels.</p>
  const open = (id: string) => window.dispatchEvent(new CustomEvent("legacy-open-game", { detail: { id, time: null } }))
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.gameId} className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{formatDateDisplay(r.date)}</span>
            <span className="block text-muted-foreground">
              {[r.tipoff && `Tip-off matchups: ${r.tipoff.assigned} of ${r.tipoff.total} defenders`, r.noContest > 0 && `${r.noContest} of ${r.shots} defended shots have no contest level`].filter(Boolean).join(". ")}
            </span>
          </span>
          <Button variant="outline" size="sm" onClick={() => open(r.gameId)}>Open game</Button>
        </li>
      ))}
    </ul>
  )
}
