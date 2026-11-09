import { useMemo, useState } from "react"
import { InlineClip } from "@/components/InlineClip"
import { Button } from "@/components/ui/button"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import type { Update } from "@/lib/store"
import type { PooleanState, ScoringEvent } from "@/lib/types"

// Editors only: shots tagged Light Contest before Got Beat existed. Each is either a defender who got beat or a real light
// contest. Answered shots drop off the list.
export function LightRecheck({ state, update }: { state: PooleanState; update: Update }) {
  const rows = useMemo(() => state.games.flatMap((g) => g.scoringEvents.filter((e) => e.contestLevel === "light" && !e.contestChecked).map((e) => ({ g, e }))).sort((a, b) => a.g.date.localeCompare(b.g.date) || (a.e.videoTime ?? 0) - (b.e.videoTime ?? 0)), [state])
  const [showing, setShowing] = useState<string | null>(null)
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Every light contest has been checked.</p>
  const answer = (gameId: string, id: string, fields: Partial<ScoringEvent>) => {
    // Answering the shot being watched moves on to the next one's clip.
    if (showing === id) {
      const i = rows.findIndex((r) => r.e.id === id)
      setShowing(rows[i + 1]?.e.id ?? null)
    }
    update((s) => ({ ...s, games: s.games.map((g) => (g.id === gameId ? { ...g, scoringEvents: g.scoringEvents.map((e) => (e.id === id ? { ...e, ...fields } : e)) } : g)) }))
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{rows.length} left.</p>
      <ul className="flex flex-col gap-2">
        {rows.map(({ g, e }) => (
          <li key={e.id} className="flex flex-col gap-1.5 border-t pt-2 text-sm">
            <span>
              {playerName(state, e.scorerId)}, {e.made !== false ? "made" : "missed"} {e.points}, on {(e.defenderIds ?? []).map((id) => playerName(state, id)).join(", ")}
              <span className="text-muted-foreground"> {formatDateDisplay(g.date)}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => answer(g.id, e.id, { contestLevel: "beat", contestChecked: true })}>Got beat</Button>
              <Button size="sm" variant="outline" onClick={() => answer(g.id, e.id, { contestChecked: true })}>Keep light</Button>
              <Button size="sm" variant="outline" aria-expanded={showing === e.id} onClick={() => setShowing(showing === e.id ? null : e.id)}>{showing === e.id ? "Hide clip" : "Show clip"}</Button>
            </div>
            {showing === e.id && <InlineClip state={state} game={g} time={e.videoTime ?? null} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
