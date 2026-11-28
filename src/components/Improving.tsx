import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Hint } from "@/components/Hint"
import { improving, LATELY, PART_LABEL } from "@/lib/improving"
import { playerName } from "@/lib/players"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"
import { signed } from "@/lib/format"


// Who's improving (improving.ts): the form rating's climb over each player's last few games, and the part of their game behind it.
export function ImprovingCard({ state, onOpenPlayer, limit }: { state: PooleanState; onOpenPlayer?: (id: string) => void; limit?: number }) {
  const rows = useMemo(() => improving(state), [state])
  if (rows.length < 2) return null
  const shown = limit ? rows.slice(0, limit) : rows
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who's improving</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Hint text={`How far each player's form rating has moved over their last ${LATELY} games, and the part of their game that moved most. The rating leans on the league average, so one big night barely moves it; a climb here means several good games in a row. Players need more than ${LATELY} filmed games.`} />
        <ol className="flex flex-col divide-y">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                {onOpenPlayer ? (
                  <button type="button" className="font-medium hover:underline" onClick={() => onOpenPlayer(r.id)}>
                    {playerName(state, r.id)}
                  </button>
                ) : (
                  <span className="font-medium">{playerName(state, r.id)}</span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {signed(r.before)} to {signed(r.now)} a game{r.change > 0.05 ? `, mostly ${PART_LABEL[r.top]} (${signed(r.parts[r.top])})` : ""}
                </span>
              </div>
              <span className={cn("shrink-0 font-semibold tabular-nums", r.change > 0.05 && "text-pos")}>{signed(r.change)}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
