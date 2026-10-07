import { Medal } from "lucide-react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { awardRace } from "@/lib/awardRace"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

// Who leads each award so far this season, from this season's own games.
export function AwardRaceCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => awardRace(state), [state])
  if (rows.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Medal aria-hidden className="size-4 text-gold" /> Season award race
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((r) => (
          <section key={r.key} aria-label={r.label} className="flex flex-col gap-0.5">
            <h4 className="text-sm font-semibold">{r.label}</h4>
            <p className="text-xs text-muted-foreground">{r.basis}</p>
            <ol className="flex flex-col gap-0.5 text-sm">
              {r.leaders.map((l, i) => (
                <li key={l.ids.join("|")} className="flex justify-between gap-2">
                  <span>
                    {i + 1}.{" "}
                    {l.ids.map((id, k) => (
                      <span key={id}>
                        {k > 0 && " and "}
                        <button type="button" className="hover:underline" onClick={() => onOpenPlayer(id)}>
                          {playerName(state, id)}
                        </button>
                      </span>
                    ))}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{l.value}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
