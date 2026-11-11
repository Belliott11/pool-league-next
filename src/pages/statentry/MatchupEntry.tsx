import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { assignmentsAt, coversTwo, sameAsLast, setAssignment, tipoffStatus, tipoffTime } from "@/lib/matchupSets"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"
import type { Apply } from "./EventForm"
import { Chip } from "./parts"

// Who each defender guards, one row per player. The tip-off set is saved at the start of the game; "New set" is for a change
// partway through, at the current video time, and "Same as last set" carries everything over when nothing changed.
export function MatchupEntry({ state, game, apply, now }: { state: PooleanState; game: Game; apply: Apply; now: () => number | null }) {
  const status = useMemo(() => tipoffStatus(game), [game])
  const start = tipoffTime(game)
  const current = assignmentsAt(game)
  const opponents = (id: string) => (game.teamA.includes(id) ? game.teamB : game.teamA)
  const times = [...new Set((game.matchups ?? []).map((m) => m.videoTime).filter((t): t is number => typeof t === "number"))].sort((a, b) => a - b)
  const last = times.length ? times[times.length - 1] : null
  const toggle = (def: string, off: string) => {
    const cur = current.get(def) ?? []
    const next = cur.includes(off) ? cur.filter((x) => x !== off) : coversTwo(game, def) ? [...cur, off] : [off]
    // On the tip-off row the change is made at the start; later ones at the newest set's time.
    apply((g) => setAssignment(g, def, next, last ?? start))
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Matchups</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className={status.assigned === status.total ? "text-sm text-muted-foreground" : "rounded-lg border border-gold px-3 py-2 text-sm text-gold"} role={status.assigned === status.total ? undefined : "alert"}>
          {status.assigned} of {status.total} defenders assigned at tip-off.
          {status.missing.length > 0 && ` Still needed: ${status.missing.map((id) => playerName(state, id)).join(", ")}.`}
        </p>
        <div className="flex flex-col gap-3">
          {[...game.teamA, ...game.teamB].map((def) => (
            <div key={def} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                {playerName(state, def)} guards{coversTwo(game, def) ? " (covers two)" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {opponents(def).map((off) => (
                  <Chip key={off} selected={(current.get(def) ?? []).includes(off)} onClick={() => toggle(def, off)}>
                    {playerName(state, off)}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-11" disabled={current.size === 0} onClick={() => apply((g) => sameAsLast(g, now() ?? last ?? start))}>
            Same as last set
          </Button>
          <p className="self-center text-xs text-muted-foreground">Saves every assignment again at the current video time. Change a row after it to move one defender.</p>
        </div>
      </CardContent>
    </Card>
  )
}
