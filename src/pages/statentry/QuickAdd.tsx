import { Zap } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { playerName } from "@/lib/players"
import { addShot, importLiveBaskets, pendingBaskets } from "@/lib/statEntry"
import type { Game, PooleanState } from "@/lib/types"
import { Chip } from "./parts"
import type { Apply } from "./EventForm"

// Shortcuts for a lot of baskets: turn the points from live scoring into shots in one tap, or add a made basket for a
// player with a single tap (the details can be filled in afterward from the log).
export function QuickAdd({ state, game, apply, captureTime }: { state: PooleanState; game: Game; apply: Apply; captureTime: () => number | null }) {
  const [points, setPoints] = useState<1 | 2 | 3>(2)
  const [last, setLast] = useState("")
  const waiting = pendingBaskets(game)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Zap aria-hidden className="size-4 text-accent" /> Quick add
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {waiting > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-2">
            <p className="min-w-0 flex-1 text-sm">
              {waiting} {waiting === 1 ? "basket was" : "baskets were"} scored live. Turn {waiting === 1 ? "it" : "them"} into shots to get the box score started, then add assists, misses and the rest.
            </p>
            <Button type="button" className="h-11" onClick={() => apply(importLiveBaskets)}>
              Use the live baskets
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Value of the basket">
          <span className="text-sm text-muted-foreground">One tap adds a made</span>
          {([1, 2, 3] as const).map((p) => (
            <Chip key={p} selected={points === p} onClick={() => setPoints(p)}>
              {p === 1 ? "1" : `${p}`}
            </Chip>
          ))}
        </div>
        {[game.teamA, game.teamB].map((team, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-12 text-xs text-muted-foreground">Team {i ? "B" : "A"}</span>
            {team.map((id) => (
              <Button
                key={id}
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  apply((g) => addShot(g, { scorerId: id, points, made: true, videoTime: captureTime() }))
                  setLast(`Added ${points} for ${playerName(state, id)}.`)
                }}
              >
                {playerName(state, id)}
              </Button>
            ))}
          </div>
        ))}
        {last && (
          <p role="status" className="text-xs text-muted-foreground">
            {last} Wrong one? Use Undo last.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
