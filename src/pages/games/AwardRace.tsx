import { Medal } from "lucide-react"
import { useMemo, useState } from "react"
import { ClipButton } from "@/components/ClipTile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { awardRace } from "@/lib/awardRace"
import { bestClips } from "@/lib/clips"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

const FIRST = 3 // awards shown before "Show all"

// Who leads each award so far this season, from this season's own games.
export function AwardRaceCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const all = useMemo(() => awardRace(state), [state])
  const [open, setOpen] = useState(false)
  // The leader's best play, when a recording has one, so an award can be seen as well as read.
  const clipOf = useMemo(() => new Map(all.flatMap((r) => r.leaders.slice(0, 1).flatMap((l) => (l.ids.length === 1 ? [[`${r.key}|${l.ids[0]}`, bestClips(state, { pid: l.ids[0], limit: 1 })[0]] as const] : [])))), [all, state])
  if (all.length === 0) return null
  const rows = open ? all : all.slice(0, FIRST)
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
                  <span className="flex items-center gap-1 tabular-nums text-muted-foreground">
                    {l.value}
                    {i === 0 && clipOf.get(`${r.key}|${l.ids[0]}`) && <ClipButton state={state} clip={clipOf.get(`${r.key}|${l.ids[0]}`)!} label={`Watch ${playerName(state, l.ids[0])}'s best play`} />}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {all.length > FIRST && (
          <button type="button" className="self-start text-sm font-medium text-accent hover:underline" onClick={() => setOpen(!open)}>
            {open ? "Show fewer" : `Show all ${all.length} awards`}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
