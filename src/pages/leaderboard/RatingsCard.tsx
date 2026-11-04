import { useMemo } from "react"
import { ArrowDown, ArrowUp } from "lucide-react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { ATTR_LABEL, ATTRS, MIN_GAMES, ratingsWithTrend, WINDOW } from "@/lib/ratings"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Everyone with a rating, best overall first, with the five attributes and the move since the latest night.
export function RatingsCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const { since, rows } = useMemo(() => ratingsWithTrend(state), [state])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Ratings</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          2K-style, from each player's last {WINDOW} box-scored games against everyone else's. {MIN_GAMES} games to get a rating. 74 is average, 85 and up is elite.
          {since && ` Arrows show the move since ${formatDateDisplay(since)}.`}
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has {MIN_GAMES} box-scored games yet.</p>
        ) : (
          <div className="overflow-x-auto" data-no-swipe>
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-medium">Player</th>
                  <th className="pb-2 text-left font-medium">OVR</th>
                  {ATTRS.map((a) => (
                    <th key={a} className="pb-2 text-right font-medium">
                      {ATTR_LABEL[a].slice(0, 4)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">
                      <button type="button" className="flex items-center gap-2 font-medium hover:underline" onClick={() => onOpenPlayer(r.id)}>
                        <PlayerAvatar id={r.id} name={playerName(state, r.id)} size="sm" />
                        {playerName(state, r.id)}
                      </button>
                    </td>
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                        {r.ovr}
                        {!!r.change && (
                          <span className={cn("inline-flex items-center text-xs font-medium", r.change > 0 ? "text-pos" : "text-neg")}>
                            {r.change > 0 ? <ArrowUp aria-hidden className="size-3" /> : <ArrowDown aria-hidden className="size-3" />}
                            {Math.abs(r.change)}
                          </span>
                        )}
                      </span>
                    </td>
                    {ATTRS.map((a) => (
                      <td key={a} className={cn("py-2 text-right tabular-nums", (r.attrs[a] ?? 0) >= 85 && "font-bold text-gold")}>
                        {r.attrs[a] ?? "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
