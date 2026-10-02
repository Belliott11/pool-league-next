import { Panel } from "@/components/Panel"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { computeLeaderboard } from "@/lib/legacy-core"
import { axis } from "./charts"

interface Row {
  player: { id: string; name: string }
  twoWayPer20: number
  gp: number
}

// One lane per player, ranked by Two-Way/20. Bars grow from the zero line (aqua above, red
// below), the leader's bar is the screen's one coral mark, and the photo sits at the bar's head.
export function LaneBars({ onOpenPlayer }: { onOpenPlayer: (id: string) => void }) {
  const rows = (computeLeaderboard() as Row[])
    .filter((r) => r.gp > 0)
    .sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
  if (rows.length === 0) return null

  // Axis ends and grid lines fall on whole steps, so the vertical lines are evenly spaced.
  const { lo, hi, ticks } = axis(Math.min(0, ...rows.map((r) => r.twoWayPer20)), Math.max(0, ...rows.map((r) => r.twoWayPer20)), 6)
  const span = hi - lo
  const zero = ((0 - lo) / span) * 100
  const pos = (v: number) => ((v - lo) / span) * 100

  return (
    <Panel title="Two-Way Ranking" hint="Offense plus defense per 20 combined points. Click a name for their page.">
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center gap-3 pb-1 text-[10px] text-muted-foreground">
          <span className="w-16 shrink-0 sm:w-24" />
          <div className="relative h-4 min-w-0 flex-1">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${pos(t)}%` }}>
                {t}
              </span>
            ))}
          </div>
          <span className="w-10 shrink-0" />
        </div>
        {rows.map((r, i) => {
          const v = r.twoWayPer20
          const left = Math.min(pos(v), zero)
          const width = Math.abs(pos(v) - zero)
          const head = pos(v)
          const color = i === 0 ? "bg-primary" : v >= 0 ? "bg-chart-2" : "bg-destructive"
          return (
            <div key={r.player.id} className="flex items-center gap-3 border-b border-dashed border-border py-1.5 last:border-b-0">
              <button
                type="button"
                className="w-16 shrink-0 truncate text-left text-sm font-semibold hover:underline sm:w-24"
                onClick={() => onOpenPlayer(r.player.id)}
              >
                {r.player.name}
              </button>
              <div className="relative h-8 min-w-0 flex-1">
                {ticks.map((t) => (
                  <span key={t} className={`absolute inset-y-0 w-px ${t === 0 ? "bg-foreground/40" : "bg-border"}`} style={{ left: `${pos(t)}%` }} />
                ))}
                <span
                  className={`absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${color}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
                <span
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                  style={{ left: `clamp(1rem, ${head}%, calc(100% - 1rem))` }}
                >
                  <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
                </span>
              </div>
              <span className="font-display w-10 shrink-0 text-right text-sm font-bold tabular-nums">{v.toFixed(1)}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
