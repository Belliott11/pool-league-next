/* eslint-disable @typescript-eslint/no-explicit-any */
import { showTick } from "@/lib/axis"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import {
  HEATMAP_ROW_BOUNDARIES,
  computeHeatmapCells,
  computeLeagueZonePointsPerAttempt,
  computePassingChemistryGrid,
  computeTwoWayRankOverSeason,
  computeXptsCombos,
  formatDateDisplay,
  isQualifyingGame,
} from "@/lib/legacy-core"
import { heatFill } from "@/lib/heat"
import type { PooleanState } from "@/lib/types"
import { useWidth } from "@/lib/useWidth"

const tickText = "fill-muted-foreground text-[10px]"

function HeatLegend({ mean, unit }: { mean: string; unit: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-pos" />
        Above league {unit} ({mean})
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm bg-neg" />
        Below
      </span>
      <span>Darker means a bigger gap and more attempts</span>
    </div>
  )
}

/* ---------- League Shot Heatmap: the half court, cells tinted against the league average ---------- */
export function LeagueHeatmap({ state }: { state: PooleanState }) {
  const shots: any[] = []
  ;(state.games as any[]).filter(isQualifyingGame).forEach((g) =>
    g.scoringEvents.forEach((ev: any) => {
      if ((ev.points === 2 || ev.points === 3) && ev.shotLocation) shots.push(ev)
    }),
  )
  if (shots.length === 0) return <p className="text-sm text-muted-foreground">No shots with a location marked yet.</p>
  const cells = (computeHeatmapCells(shots) as any[]).filter((c) => c.attempts > 0)
  const mean = shots.filter((e) => e.made !== false).length / shots.length
  const W = 300
  const H = 360
  const P = 8
  const X = (v: number) => P + (v / 100) * (W - P * 2)
  const Y = (v: number) => H - P - (v / 100) * (H - P * 2)
  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="rounded-xl border bg-card p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="League shot heat map by court zone">
          <rect x={P} y={P} width={W - P * 2} height={H - P * 2} rx={4} className="fill-none stroke-foreground/40" />
          {(HEATMAP_ROW_BOUNDARIES as number[]).slice(1, -1).map((b) => (
            <line key={`r${b}`} x1={P} x2={W - P} y1={Y(b)} y2={Y(b)} className="stroke-border" />
          ))}
          {[1, 2, 3, 4].map((c) => (
            <line key={`c${c}`} x1={X(c * 20)} x2={X(c * 20)} y1={P} y2={H - P} className="stroke-border" />
          ))}
          <circle cx={W / 2} cy={Y(7)} r={5} className="fill-none stroke-foreground/50" strokeWidth={2} />
          {cells.map((c) => {
            const pct = Math.round((c.makes / c.attempts) * 100)
            const cx = X(c.x + c.w / 2)
            const cy = (Y(c.y) + Y(c.y + c.h)) / 2
            return (
              <g key={`${c.x}-${c.y}`}>
                <title>{`${c.makes} of ${c.attempts} made (${pct}%)`}</title>
                <rect
                  x={X(c.x) + 1}
                  y={Y(c.y + c.h) + 1}
                  width={X(c.x + c.w) - X(c.x) - 2}
                  height={Y(c.y) - Y(c.y + c.h) - 2}
                  rx={2}
                  style={{ fill: heatFill(c.makes / c.attempts, mean, 0.35, c.attempts, 8) }}
                />
                <text x={cx} y={cy - 2} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                  {c.attempts}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" className="fill-foreground/70 text-[9px]">
                  {pct}%
                </text>
              </g>
            )
          })}
          <line x1={P} x2={W - P} y1={Y(60)} y2={Y(60)} strokeDasharray="4 3" className="stroke-foreground/50" />
          <text x={W - P - 3} y={Y(60) - 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-semibold">
            3PT
          </text>
        </svg>
      </div>
      <HeatLegend mean={`${Math.round(mean * 100)}% FG`} unit="FG%" />
      <p className="mt-1 text-xs text-muted-foreground">{shots.length} shots plotted. The bold number is attempts.</p>
    </div>
  )
}

/* ---------- Two-Way/20 Rank Over the Season: rank 1 on top, every night on an even grid ---------- */
export function TwoWayRankChart({ state }: { state: PooleanState }) {
  const [ref, W] = useWidth()
  const { dates, series } = computeTwoWayRankOverSeason() as { dates: string[]; series: Record<string, { date: string; rank: number; twoWay: number }[]> }
  const ids = Object.keys(series).filter((id) => state.players.some((p) => p.id === id))
  if (dates.length === 0 || ids.length === 0) return <p className="text-sm text-muted-foreground">No games logged yet.</p>
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const maxRank = Math.max(...ids.flatMap((id) => series[id].map((p) => p.rank)))
  const L = 34
  const R = W < 420 ? 60 : 96
  const T = 26
  const rowH = 26
  const B = 34
  const H = T + (maxRank - 1) * rowH + B
  const x = (i: number) => (dates.length === 1 ? (L + W - R) / 2 : L + (i / (dates.length - 1)) * (W - L - R))
  const y = (rank: number) => T + (rank - 1) * rowH
  const idx: Record<string, number> = Object.fromEntries(dates.map((d, i) => [d, i]))
  const last = (id: string) => series[id][series[id].length - 1]
  const move = (id: string) => (series[id].length > 1 ? series[id][0].rank - last(id).rank : 0)
  const climber = ids.reduce((a, b) => (move(b) > move(a) ? b : a), ids[0])
  const faller = ids.reduce((a, b) => (move(b) < move(a) ? b : a), ids[0])
  const roleOf = (id: string) => (last(id).rank === 1 ? "lead" : id === climber && move(id) > 0 ? "up" : id === faller && move(id) < 0 ? "down" : "rest")
  const stroke: Record<string, string> = { lead: "stroke-primary", up: "stroke-pos", down: "stroke-neg", rest: "stroke-muted-foreground/45" }
  const fill: Record<string, string> = { lead: "fill-primary", up: "fill-pos", down: "fill-neg", rest: "fill-muted-foreground/60" }
  const rank = ["rest", "down", "up", "lead"]
  const order = [...ids].sort((a, b) => rank.indexOf(roleOf(a)) - rank.indexOf(roleOf(b)))
  return (
    <div>
      <div ref={ref} className="w-full rounded-xl border bg-card p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Two-Way rating rank by night">
          {Array.from({ length: maxRank }, (_, i) => i + 1).map((r) => (
            <g key={r}>
              <line x1={L} x2={W - R} y1={y(r)} y2={y(r)} className="stroke-border" />
              <text x={L - 8} y={y(r) + 3} textAnchor="end" className={tickText}>
                #{r}
              </text>
            </g>
          ))}
          {dates.map((d, i) => (
            <g key={d}>
              <line x1={x(i)} x2={x(i)} y1={T} y2={y(maxRank)} className="stroke-border" />
              {showTick(i, dates.length, W - L - R) && (
                <text x={x(i)} y={H - B + 16} textAnchor={i === 0 ? "start" : i === dates.length - 1 ? "end" : "middle"} className={tickText}>
                  {formatDateDisplay(d)}
                </text>
              )}
            </g>
          ))}
          {order.map((id) => {
            const role = roleOf(id)
            const pts = series[id]
            const d = pts.map((p, i) => `${i ? "L" : "M"}${x(idx[p.date])},${y(p.rank)}`).join(" ")
            const end = last(id)
            return (
              <g key={id}>
                <path d={d} className={`fill-none ${stroke[role]}`} strokeWidth={role === "rest" ? 1.5 : 2.5} strokeLinejoin="round" />
                {pts.map((p) => (
                  <circle key={p.date} cx={x(idx[p.date])} cy={y(p.rank)} r={role === "rest" ? 2.5 : 3.5} className={`${fill[role]} stroke-card`} strokeWidth={1.5}>
                    <title>{`${nameOf(id)}: #${p.rank} on ${formatDateDisplay(p.date)} (${p.twoWay.toFixed(1)} Two-Way/20)`}</title>
                  </circle>
                ))}
                <text x={x(idx[end.date]) + 9} y={y(end.rank) + 3} className={`text-[10px] ${role === "rest" ? "fill-muted-foreground" : "fill-foreground font-bold"}`}>
                  {nameOf(id)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" />
          Currently first
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-pos" />
          Biggest climb
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-neg" />
          Biggest drop
        </span>
      </div>
    </div>
  )
}

/* ---------- Passing Chemistry grid: expected points per pass, tinted against the league average ---------- */
export function PassingChemistryGrid({ onOpen }: { onOpen: (id: string) => void }) {
  const { passers, scorers, cellFor } = computePassingChemistryGrid(computeXptsCombos(), computeLeagueZonePointsPerAttempt()) as unknown as {
    passers: { id: string; name: string }[]
    scorers: { id: string; name: string }[]
    cellFor: (p: string, s: string) => { shots: number; xptsSum: number } | null
  }
  if (passers.length === 0 || scorers.length === 0) return <p className="text-sm text-muted-foreground">No shots with a passer credited yet.</p>
  let sum = 0
  let n = 0
  passers.forEach((p) =>
    scorers.forEach((s) => {
      const c = cellFor(p.id, s.id)
      if (c) {
        sum += c.xptsSum
        n += c.shots
      }
    }),
  )
  const mean = n ? sum / n : 0
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card p-2 text-left text-xs font-medium text-muted-foreground">Passer (down), Scorer (across)</th>
              {scorers.map((s) => (
                <th key={s.id} className="w-16 min-w-16 p-1 text-center text-xs font-semibold">
                  <button type="button" className="hover:underline" onClick={() => onOpen(s.id)}>
                    {s.name}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {passers.map((p) => (
              <tr key={p.id}>
                <th className="sticky left-0 bg-card p-2 text-left font-semibold">
                  <button type="button" className="flex items-center gap-2 hover:underline" onClick={() => onOpen(p.id)}>
                    <PlayerAvatar id={p.id} name={p.name} size="sm" />
                    {p.name}
                  </button>
                </th>
                {scorers.map((s) => {
                  const c = cellFor(p.id, s.id)
                  if (!c)
                    return (
                      <td key={s.id} className="h-10 w-16 border border-border/60 text-center text-muted-foreground">
                        -
                      </td>
                    )
                  const avg = c.xptsSum / c.shots
                  return (
                    <td
                      key={s.id}
                      title={`${p.name} to ${s.name}: ${avg.toFixed(2)} xPTS per pass over ${c.shots} shot${c.shots === 1 ? "" : "s"}`}
                      className="h-10 w-16 border border-border/60 text-center font-display font-bold tabular-nums"
                      style={{ backgroundColor: heatFill(avg, mean, 0.4, c.shots, 6) }}
                    >
                      {avg.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HeatLegend mean={`${mean.toFixed(2)} xPTS`} unit="xPTS per pass" />
    </div>
  )
}
