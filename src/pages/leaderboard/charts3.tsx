/* eslint-disable @typescript-eslint/no-explicit-any */
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { axis } from "@/lib/axis"
import {
  PLAY_STYLE_MIN_GP,
  PLAY_STYLE_MIN_PLAYERS,
  computeLeagueZonePointsPerAttempt,
  computePlayerStyleClusters,
  computeShotMakingAddedOverSeason,
  computeXptsCombos,
  formatDateDisplay,
} from "@/lib/legacy-core"
import type { PooleanState } from "@/lib/types"

const tickText = "fill-muted-foreground text-[10px]"
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`

/* ---------- Shot-Making Added, cumulative: points scored above what the shots were worth ---------- */
export function ShotMakingAddedChart({ state }: { state: PooleanState }) {
  const { dates, series } = computeShotMakingAddedOverSeason(computeXptsCombos(), computeLeagueZonePointsPerAttempt()) as {
    dates: string[]
    series: Record<string, { date: string; added: number }[]>
  }
  const ids = Object.keys(series).filter((id) => state.players.some((p) => p.id === id))
  if (dates.length === 0 || ids.length === 0) return <p className="text-sm text-muted-foreground">No games logged yet.</p>
  const nameOf = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const all = ids.flatMap((id) => series[id].map((p) => p.added))
  const ay = axis(Math.min(0, ...all), Math.max(0, ...all), 6)
  const W = 600
  const H = 380
  const L = 44
  const R = 110
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
  const gap = 12
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
      <div className="w-full rounded-xl border bg-card p-2">
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
              <text x={x(i)} y={H - B + 14} textAnchor="middle" className={tickText}>
                {formatDateDisplay(d)}
              </text>
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

/* ---------- Play Style Clusters: groups of similar players. Colors only tell groups apart. ---------- */
const GROUP = ["bg-chart-4", "bg-chart-5", "bg-muted-foreground", "bg-chart-3"]

export function PlayStyleClusters({ onOpen }: { onOpen: (id: string) => void }) {
  const clusters = computePlayerStyleClusters() as { label: string; explain: string; members: { player: { id: string; name: string } }[] }[] | null
  if (!clusters) {
    return (
      <p className="text-sm text-muted-foreground">
        Needs at least {PLAY_STYLE_MIN_PLAYERS} players with {PLAY_STYLE_MIN_GP}+ qualifying games to cluster yet.
      </p>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {clusters.map((c, i) => (
        <div key={c.label} className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-2">
            <span className={`size-3 rounded-full ${GROUP[i % GROUP.length]}`} />
            <h4 className="font-display font-bold">{c.label}</h4>
            <span className="text-xs text-muted-foreground">({c.members.length})</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{c.explain}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.members.map((m) => (
              <button
                key={m.player.id}
                type="button"
                className="flex items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-3 text-sm font-semibold hover:bg-muted"
                onClick={() => onOpen(m.player.id)}
              >
                <PlayerAvatar id={m.player.id} name={m.player.name} size="sm" />
                {m.player.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
