import { useMemo } from "react"
import { Sun } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { useReadOnly } from "@/lib/mode"
import { playerName } from "@/lib/players"
import { MIN_NIGHTS, weatherGame, type Split } from "@/lib/weatherGame"
import type { PooleanState } from "@/lib/types"

const pc = (x: number) => `${Math.round(x * 100)}%`
const pts = (x: number) => (x >= 0 ? `+${x.toFixed(1)}` : x.toFixed(1))

function SplitLine({ s }: { s: Split }) {
  const [a, b] = s.label
  const verdict = s.real
    ? `${s.fgDiff > 0 ? a : b} nights shoot better: ${pc(s.fgDiff > 0 ? s.a.fg : s.b.fg)} against ${pc(s.fgDiff > 0 ? s.b.fg : s.a.fg)}.`
    : `No clear difference yet: ${pc(s.a.fg)} against ${pc(s.b.fg)} from the field.`
  return (
    <li className="flex flex-col gap-0.5">
      <span className="font-medium">
        {a} ({s.cut}) against {b.toLowerCase()}
      </span>
      <span>{verdict}</span>
      <span className="text-xs text-muted-foreground">
        Points per shot {s.a.pps.toFixed(2)} against {s.b.pps.toFixed(2)}; 3s are {pc(s.a.threeShare)} of shots against {pc(s.b.threeShare)}. {s.a.shots} and {s.b.shots} shots over {s.a.nights} and {s.b.nights} nights.
      </span>
    </li>
  )
}

// "Does the weather change the game?" on the Leaderboard's Trends tab (src/lib/weatherGame.ts). Visitors see it from MIN_NIGHTS filmed
// nights; the editor sees it before that, marked as a preview.
export function WeatherCard({ state }: { state: PooleanState }) {
  const readOnly = useReadOnly()
  const w = useMemo(() => weatherGame(state), [state])
  if (!w.nights.length || (!w.ready && readOnly)) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Sun aria-hidden className="size-5 text-gold" /> Does the weather change the game?
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Every filmed game against the weather it was played in, from Cherry Hill's hourly record.
          {!w.ready && ` Preview, only you see it: ${w.nights.length} of ${MIN_NIGHTS} filmed nights so far, too few to say anything.`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {(w.temp || w.sky) && (
          <ul className="flex flex-col gap-3">
            {w.temp && <SplitLine s={w.temp} />}
            {w.sky && <SplitLine s={w.sky} />}
          </ul>
        )}
        {w.players.length > 0 && (
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Warmer nights against cooler, by player</h4>
            <ul className="flex flex-col gap-1">
              {w.players.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{playerName(state, p.id)}</span>: {pc(p.warmFg)} warmer, {pc(p.coolFg)} cooler
                  <span className="text-muted-foreground">
                    {" "}
                    ({p.warmShots} and {p.coolShots} shots; {pts(p.lean)} points after leaning toward no difference)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Each filmed night</h4>
          <ul className="grid gap-1 sm:grid-cols-2">
            {w.nights.map((n) => (
              <li key={n.date} className="flex justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5 tabular-nums">
                <span>
                  {formatDateDisplay(n.date)} <span className="text-muted-foreground">{Math.round(n.t)}°F, {n.cloud < 25 ? "clear" : n.cloud < 60 ? "some clouds" : "cloudy"}</span>
                </span>
                <span>
                  {pc(n.fg)} <span className="text-muted-foreground">on {n.shots}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
