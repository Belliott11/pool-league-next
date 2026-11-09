import { useMemo, useState } from "react"
import { InlineClip } from "@/components/InlineClip"
import { Button } from "@/components/ui/button"
import { BLANK_LABEL, findBlanks } from "@/lib/blanks"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

// Editors only: the plays that are missing a tag, with the clip playable right here. Fixes go through the game's own stat
// entry, and a fixed play drops off this list.
export function FixBlanks({ state }: { state: PooleanState }) {
  const blanks = useMemo(() => findBlanks(state), [state])
  const [showing, setShowing] = useState<string | null>(null)
  if (blanks.length === 0) return <p className="text-sm text-muted-foreground">Nothing is missing a tag.</p>
  const open = (id: string, time: number | null) => window.dispatchEvent(new CustomEvent("legacy-open-game", { detail: { id, time } }))
  return (
    <ul className="flex flex-col gap-2">
      {blanks.map((b) => (
        <li key={b.key} className="flex flex-col gap-2 border-t pt-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0">
              <span className="font-medium">{BLANK_LABEL[b.kind]}</span>
              <span className="text-muted-foreground"> on {playerName(state, b.playerId)}'s play, {formatDateDisplay(b.date)}</span>
            </span>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" aria-expanded={showing === b.key} onClick={() => setShowing(showing === b.key ? null : b.key)}>{showing === b.key ? "Hide clip" : "Show clip"}</Button>
              <Button variant="outline" size="sm" onClick={() => open(b.gameId, b.time)}>Open game</Button>
            </span>
          </div>
          {showing === b.key && <InlineClip state={state} game={state.games.find((g) => g.id === b.gameId)!} time={b.time} />}
        </li>
      ))}
    </ul>
  )
}
