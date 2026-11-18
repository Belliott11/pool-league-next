import { TrendingUp } from "lucide-react"
import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isOffseason } from "@/lib/offseason"
import { playerName } from "@/lib/players"
import { projectSeason, type Projection } from "@/lib/projections"
import type { PooleanState } from "@/lib/types"

const HORIZONS = [10, 20, 40]
const SHOWN = 4
export const chance = (p: number) => (p >= 0.995 ? "99%+" : p < 0.005 ? "under 1%" : `${Math.round(p * 100)}%`)

// Projected award standings and points milestones if the season keeps going the way it has. Awards are voted, so what is projected is who
// would lead the stats (the case a voter sees), never who wins.
export function ProjectionsCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const [more, setMore] = useState(20)
  const s = useMemo(() => projectSeason(state, more), [state, more])
  if (s.mvp.length < 2) return null
  // Between seasons the same sum answers a different question: how safe the final standings were.
  const over = isOffseason(state)
  const who = (id: string) => (
    <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => onOpenPlayer(id)}>
      {playerName(state, id)}
    </button>
  )
  const odds = (title: string, note: string, rows: Projection[]) => (
    <section aria-label={title} className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-xs text-muted-foreground">{note}</p>
      {rows.slice(0, SHOWN).map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <span className="flex w-24 min-w-0">{who(r.id)}</span>
          <div role="img" aria-label={`${chance(r.win)} of projected seasons`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span className="block h-full bg-accent" style={{ width: `${r.win * 100}%` }} />
          </div>
          <span className="w-16 text-right tabular-nums">{chance(r.win)}</span>
        </div>
      ))}
    </section>
  )
  const near = s.milestones.slice(0, SHOWN)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <TrendingUp aria-hidden className="size-4 text-accent" /> {over ? "Projected finish, had the season kept going" : "Projected season"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {over ? "If it had run" : "If the season runs"}
          <select className="rounded-md border bg-background px-2 py-1" value={more} onChange={(e) => setMore(Number(e.target.value))}>
            {HORIZONS.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          more filmed games
        </label>
        {odds("Projected MVP race", "Share of projected seasons they lead the total two-way score. MVP is voted, so this is who is best placed.", s.mvp)}
        {odds("Projected Defender race", "Share of projected seasons they lead the total defensive score. Defender is voted too.", s.defender)}
        {!over && (
        <section aria-label="Points milestones" className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">Next points milestone</h4>
          {near.map((m) => (
            <div key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0">{who(m.id)}</span>
              <span className="text-right tabular-nums text-muted-foreground">
                {m.next - m.pts} from {m.next}, {chance(m.chance)}
              </span>
            </div>
          ))}
        </section>
        )}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">How this is worked out</summary>
          <p className="mt-1">
            From the {s.games} filmed {s.games === 1 ? "game" : "games"} this season. {over ? "The extra games are" : "The rest of the season is"} played out 2,000 times: in each made-up game a player shows up as often as they have so far and repeats one of their own past games. The percentage is the share of those seasons they finish with the top stats. Awards are voted, so it shows who is best placed for the vote, not who will win it. It knows nothing about injuries, new players or anyone getting better, and a player with only a few games is a rough guess.
          </p>
        </details>
      </CardContent>
    </Card>
  )
}
