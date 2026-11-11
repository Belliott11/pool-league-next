import { useMemo, useState } from "react"
import { InlineClip } from "@/components/InlineClip"
import { Button } from "@/components/ui/button"
import { TAGGABLE_SHOT_TYPES } from "@/lib/legacy-core"
import { editShot } from "@/lib/statEntry"
import type { Update } from "@/lib/store"
import { Chip, HalfCourt } from "@/pages/statentry/parts"
import { BLANK_LABEL, findBlanks, type Blank } from "@/lib/blanks"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

// Editors only: the plays that are missing a tag, with the clip and the fix right here. A fixed play drops off this list.
export function FixBlanks({ state, update }: { state: PooleanState; update: Update }) {
  const blanks = useMemo(() => findBlanks(state), [state])
  const [showing, setShowing] = useState<string | null>(null)
  const fill = (b: Blank, patch: Parameters<typeof editShot>[2]) => update((s) => ({ ...s, games: s.games.map((g) => (g.id === b.gameId ? editShot(g, b.eventId, patch) : g)) }))
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
          {b.kind === "shotType" && (
            <div className="flex flex-wrap gap-1.5">
              {(TAGGABLE_SHOT_TYPES as { key: string; label: string }[]).map((t) => (
                <Chip key={t.key} onClick={() => fill(b, { shotType: t.key })}>{t.label}</Chip>
              ))}
            </div>
          )}
          {b.kind === "catch" && (
            <div className="flex flex-wrap gap-1.5" title="Catch and shoot: the shot starts in one motion from the catch. Feet can gather, but no fake, no dribble and no pause.">
              <Chip onClick={() => fill(b, { catchAndShoot: true })}>Catch and shoot</Chip>
              <Chip onClick={() => fill(b, { catchAndShoot: false })}>Held it</Chip>
            </div>
          )}
          {b.kind === "rebounder" && (
            <div className="flex flex-wrap gap-1.5">
              {[...(state.games.find((g) => g.id === b.gameId)?.teamA ?? []), ...(state.games.find((g) => g.id === b.gameId)?.teamB ?? [])].map((id) => (
                <Chip key={id} onClick={() => fill(b, { rebounderId: id })}>{playerName(state, id)}</Chip>
              ))}
            </div>
          )}
          {b.kind === "location" && showing === b.key && <HalfCourt value={null} onChange={(loc) => loc && fill(b, { shotLocation: loc })} />}
          {b.kind === "location" && showing !== b.key && <span className="text-xs text-muted-foreground">Show the clip to mark the spot on the court.</span>}
          {showing === b.key && <InlineClip state={state} game={state.games.find((g) => g.id === b.gameId)!} time={b.time} />}
        </li>
      ))}
    </ul>
  )
}
