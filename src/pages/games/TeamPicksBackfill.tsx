import { useMemo } from "react"
import { PickChips, type PickMethodKey } from "@/components/GameTags"
import { formatDateDisplay } from "@/lib/format"
import { oldGames } from "@/lib/hallOfFame"
import { playerName } from "@/lib/players"
import { picksByResult } from "@/lib/ruleTests"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"
import { gameKey, results } from "@/lib/winImpact"

// Editors only: fill in from memory how the teams were picked for games already played. A game with the same teams as
// the one before it is shown as a runback until someone says otherwise.
export function TeamPicksBackfill({ state, update }: { state: PooleanState; update: Update }) {
  const rows = useMemo(() => results(state, oldGames()), [state])
  const picks = picksByResult(state)
  const set = (date: string, a: string[], b: string[], v: PickMethodKey | undefined) =>
    update((s) => {
      const key = gameKey(date, a, b)
      const inApp = s.games.some((g) => gameKey(g.date, g.teamA, g.teamB) === key)
      if (inApp) return { ...s, games: s.games.map((g) => (gameKey(g.date, g.teamA, g.teamB) === key ? { ...g, teamsPickedBy: v } : g)) }
      const next = { ...((s.oldGamePicks ?? {}) as Record<string, string>) }
      if (v) next[key] = v
      else delete next[key]
      return { ...s, oldGamePicks: next }
    })
  const names = (t: string[]) => t.map((id) => playerName(state, id)).join(", ")
  const tagged = rows.filter((r) => picks.has(gameKey(r.night, r.a, r.b))).length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{tagged} of {rows.length} games tagged. Skip any you do not remember.</p>
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const key = gameKey(r.night, r.a, r.b)
          const prev = rows[i - 1]
          // Same teams, same night: the key is shared with the game before, and this one is a runback whatever that one was.
          const rematch = prev?.night === r.night && gameKey(prev.night, prev.a, prev.b) === key
          return (
            <li key={`${key}-${i}`} className="flex flex-col gap-1.5 border-t pt-2 text-sm">
              <span>
                <span className="text-muted-foreground">{formatDateDisplay(r.night)}: </span>
                {names(r.a)} <span className="text-muted-foreground">v</span> {names(r.b)}
              </span>
              {rematch ? <span className="text-xs text-muted-foreground">Run it back: same teams as the game before.</span> : <PickChips value={picks.get(key)} onChange={(v) => set(r.night, r.a, r.b, v)} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
