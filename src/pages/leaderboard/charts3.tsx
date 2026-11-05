import { EmptyState } from "@/components/EmptyState"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { axis, showTick } from "@/lib/axis"
import {
  PLAY_STYLE_MIN_GP,
  PLAY_STYLE_MIN_PLAYERS,
  computeLeagueZonePointsPerAttempt,
  computePlayerStrengths,
  computeShotMakingAddedOverSeason,
  computeXptsCombos,
  formatDateDisplay,
} from "@/lib/legacy-core"
import type { PooleanState } from "@/lib/types"
import { useWidth } from "@/lib/useWidth"

const tickText = "fill-muted-foreground text-[10px]"
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`

/* ---------- Shot-Making Added, cumulative: points scored above what the shots were worth ---------- */
export function ShotMakingAddedChart({ state }: { state: PooleanState }) {
  const [ref, W] = useWidth()
  const { dates, series } = computeShotMakingAddedOverSeason(computeXptsCombos(), computeLeagueZonePointsPerAttempt()) as {
    dates: string[]
    series: Record<string, { date: string; added: number }[]>
  }
  const ids = Object.keys(series).filter((id) => state.players.some((p) => p.id === id))
  if (dates.length === 0 || ids.length === 0) return <EmptyState title="No games logged yet" hint="Log a few games and this trend fills in." />
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const all = ids.flatMap((id) => series[id].map((p) => p.added))
  const ay = axis(Math.min(0, ...all), Math.max(0, ...all), 6)
  const H = Math.round(Math.max(300, Math.min(W * 0.75, 420)))
  const L = 44
  const R = W < 420 ? 78 : 110
  const T = 18
  const B = 40
  const x = (i: number) => (dates.length === 1 ? (L + W - R) / 2 : L + (i / (dates.length - 1)) * (W - L - R))
  const y = (v: number) => H - B - ((v - ay.lo) / (ay.hi - ay.lo)) * (H - T - B)
  const idx: Record<string, number> = Object.fromEntries(dates.map((d, i) => [d, i]))
  const last = (id: string) => series[id][series[id].length - 1]
  const byEnd = [...ids].sort((a, b) => last(b).added - last(a).added)
  const leader = byEnd[0]
  const trailer = byEnd[byEnd.length - 1]
  const role = (id: string) => (id === leader ? "lead" : id === trailer && last(id).added < 0 ? "down" : "rest")
  const stroke: Record<string, string> = { lead: "stroke-primary", down: "stroke-neg", rest: "stroke-muted-foreground/45" }
  const fill: Record<string, string> = { lead: "fill-primary", down: "fill-neg", rest: "fill-muted-foreground/60" }
  // End labels sit at each line's last value, nudged apart so no two overlap.
  const gap = 14
  const labelY: Record<string, number> = {}
  let prev = -Infinity
  byEnd.forEach((id) => {
    const target = y(last(id).added)
    labelY[id] = Math.max(target, prev + gap)
    prev = labelY[id]
  })
  const order = [...ids].sort((a, b) => ["rest", "down", "lead"].indexOf(role(a)) - ["rest", "down", "lead"].indexOf(role(b)))
  return (
    <div>
      <div ref={ref} className="w-full rounded-xl border bg-card p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative shot-making added by night">
          {ay.ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-foreground/50" : "stroke-border"} />
              <text x={L - 5} y={y(t) + 3} textAnchor="end" className={tickText}>
                {t > 0 ? `+${t}` : t}
              </text>
            </g>
          ))}
          {dates.map((d, i) => (
            <g key={d}>
              <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} className="stroke-border" />
              {showTick(i, dates.length, W - L - R) && (
                <text x={x(i)} y={H - B + 14} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"} className={tickText}>
                  {formatDateDisplay(d)}
                </text>
              )}
            </g>
          ))}
          {order.map((id) => {
            const r = role(id)
            const pts = series[id]
            const d = pts.map((p, i) => `${i ? "L" : "M"}${x(idx[p.date])},${y(p.added)}`).join(" ")
            const end = last(id)
            return (
              <g key={id}>
                <path d={d} className={`fill-none ${stroke[r]}`} strokeWidth={r === "rest" ? 1.5 : 2.5} strokeLinejoin="round" />
                {pts.map((p) => (
                  <circle key={p.date} cx={x(idx[p.date])} cy={y(p.added)} r={r === "rest" ? 2.5 : 3.5} className={`${fill[r]} stroke-card`} strokeWidth={1.5}>
                    <title>{`${nameOf(id)}: ${signed(p.added)} as of ${formatDateDisplay(p.date)}`}</title>
                  </circle>
                ))}
                <text x={x(idx[end.date]) + 9} y={labelY[id] + 3} className={`text-[10px] ${r === "rest" ? "fill-muted-foreground" : "fill-foreground font-bold"}`}>
                  {nameOf(id)} {signed(end.added)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" />
          Most points added
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-neg" />
          Most points lost, when below zero
        </span>
      </div>
    </div>
  )
}

/* ---------- Stat Strengths: each player against the league average, stat by stat ---------- */
const STAND_OUT = 0.75

export function PlayStyleClusters({ onOpen }: { onOpen: (id: string) => void }) {
  const rows = computePlayerStrengths() as { player: { id: string; name: string }; gp: number; stats: { label: string; z: number }[] }[] | null
  if (!rows) {
    return <EmptyState title="Not enough players yet" hint={`Appears once at least ${PLAY_STYLE_MIN_PLAYERS} players have ${PLAY_STYLE_MIN_GP}+ qualifying games.`} />
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const up = r.stats.filter((s) => s.z >= STAND_OUT).sort((a, b) => b.z - a.z)
        const down = r.stats.filter((s) => s.z <= -STAND_OUT).sort((a, b) => a.z - b.z)
        return (
          <div key={r.player.id} className="flex flex-col gap-1 rounded-xl border bg-card p-3">
            <button type="button" className="flex items-center gap-2 self-start text-sm font-semibold hover:underline" onClick={() => onOpen(r.player.id)}>
              <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
              {r.player.name}
              <span className="text-xs font-normal text-muted-foreground">{r.gp} games</span>
            </button>
            {up.length === 0 && down.length === 0 ? (
              <p className="text-sm text-muted-foreground">Near the league average in everything.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {up.map((s) => (
                  <span key={s.label} className="rounded-full bg-chart-4/20 px-2 py-0.5 font-medium">
                    Strong: {s.label}
                  </span>
                ))}
                {down.map((s) => (
                  <span key={s.label} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    Weaker: {s.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">Compared with the league average per 20. Only stats at least 0.75 standard deviations from average are listed, and with few games a player's list can change quickly.</p>
    </div>
  )
}
