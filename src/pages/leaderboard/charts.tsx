/* eslint-disable @typescript-eslint/no-explicit-any */
import { computeLeagueTsByZone, computeQuadrantData, computeVolumeEfficiencyData } from "@/lib/legacy-core"
import { playerPhotoUrl } from "@/lib/players"

type Open = (id: string) => void

// A step of 1, 2, 2.5 or 5 times a power of ten, giving about `count` equal cells over `span`.
function niceStep(span: number, count = 5) {
  const raw = span / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const f = raw / mag
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag
}

// Axis ends snapped to whole steps, so every grid cell is exactly the same size.
export function axis(min: number, max: number, count = 5) {
  const step = niceStep(Math.max(max - min, 1e-6), count)
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  const ticks: number[] = []
  for (let v = lo; v <= hi + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { lo, hi, ticks }
}

const tickText = "fill-muted-foreground text-[10px]"

function PhotoDot({ id, cx, cy, r = 11 }: { id: string; cx: number; cy: number; r?: number }) {
  const photo = playerPhotoUrl(id)
  return (
    <>
      <clipPath id={`dot-${id}-${Math.round(cx)}-${Math.round(cy)}`}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      <circle cx={cx} cy={cy} r={r} className="fill-primary" />
      {photo && (
        <image href={photo} x={cx - r} y={cy - r} width={r * 2} height={r * 2} clipPath={`url(#dot-${id}-${Math.round(cx)}-${Math.round(cy)})`} preserveAspectRatio="xMidYMid slice" />
      )}
      <circle cx={cx} cy={cy} r={r} className="fill-none stroke-card" strokeWidth={2} />
    </>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-md rounded-xl border bg-card p-2">{children}</div>
}

/* ---------- Two-Way Quadrant: offense across, defense up; zero lines on the grid ---------- */
export function TwoWayQuadrant({ onOpen }: { onOpen: Open }) {
  const data = computeQuadrantData() as { player: { id: string; name: string }; offRtg: number; defRtg: number }[]
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No games logged yet.</p>
  const W = 360
  const H = 360
  const PAD = 36
  const m = (vals: number[]) => Math.max(1, ...vals.map(Math.abs)) * 1.1
  const ax = axis(-m(data.map((d) => d.offRtg)), m(data.map((d) => d.offRtg)), 6)
  const ay = axis(-m(data.map((d) => d.defRtg)), m(data.map((d) => d.defRtg)), 6)
  const x = (v: number) => PAD + ((v - ax.lo) / (ax.hi - ax.lo)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - ay.lo) / (ay.hi - ay.lo)) * (H - PAD * 2)
  return (
    <Frame>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Offense versus defense rating per player">
        <rect x={x(0)} y={PAD} width={W - PAD - x(0)} height={y(0) - PAD} className="fill-chart-2/10" />
        {ax.ticks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={PAD} y2={H - PAD} className={t === 0 ? "stroke-foreground/50" : "stroke-border"} />
            <text x={x(t)} y={H - PAD + 13} textAnchor="middle" className={tickText}>{t}</text>
          </g>
        ))}
        {ay.ticks.map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD} x2={W - PAD} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-foreground/50" : "stroke-border"} />
            <text x={PAD - 5} y={y(t) + 3} textAnchor="end" className={tickText}>{t}</text>
          </g>
        ))}
        <text x={W - PAD - 4} y={PAD + 12} textAnchor="end" className={`${tickText} font-semibold`}>Two-way</text>
        <text x={PAD + 4} y={PAD + 12} className={`${tickText} font-semibold`}>Defender</text>
        <text x={W - PAD - 4} y={H - PAD - 6} textAnchor="end" className={`${tickText} font-semibold`}>Scorer</text>
        <text x={W / 2} y={H - 4} textAnchor="middle" className={tickText}>Off Rating/20</text>
        <text transform={`translate(10 ${H / 2}) rotate(-90)`} textAnchor="middle" className={tickText}>Def Rating/20</text>
        {data.map((d) => (
          <g key={d.player.id} className="cursor-pointer" onClick={() => onOpen(d.player.id)}>
            <title>{`${d.player.name}: ${d.offRtg.toFixed(1)} Off, ${d.defRtg.toFixed(1)} Def`}</title>
            <PhotoDot id={d.player.id} cx={x(d.offRtg)} cy={y(d.defRtg)} />
            <text x={x(d.offRtg)} y={y(d.defRtg) - 15} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
              {d.player.name}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  )
}

/* ---------- Volume vs. Efficiency: how much each player shoots against how well ---------- */
export function VolumeEfficiency({ onOpen }: { onOpen: Open }) {
  const data = computeVolumeEfficiencyData() as { player: { id: string; name: string }; volume: number; ts: number }[]
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No field goals logged yet.</p>
  const W = 380
  const H = 340
  const L = 44
  const R = 16
  const T = 16
  const B = 38
  const ax = axis(0, Math.max(...data.map((d) => d.volume)) * 1.05, 5)
  // TS% is not capped at 100 for a small sample, so the axis follows the data.
  const ay = axis(Math.max(0, Math.min(...data.map((d) => d.ts)) - 8), Math.max(...data.map((d) => d.ts)) * 1.05, 5)
  const x = (v: number) => L + ((v - ax.lo) / (ax.hi - ax.lo)) * (W - L - R)
  const y = (v: number) => H - B - ((v - ay.lo) / (ay.hi - ay.lo)) * (H - T - B)
  return (
    <Frame>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Shot volume versus true shooting percentage per player">
        {ax.ticks.map((t) => (
          <g key={`x${t}`}>
            <line x1={x(t)} x2={x(t)} y1={T} y2={H - B} className="stroke-border" />
            <text x={x(t)} y={H - B + 13} textAnchor="middle" className={tickText}>{t}</text>
          </g>
        ))}
        {ay.ticks.map((t) => (
          <g key={`y${t}`}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-border" />
            <text x={L - 5} y={y(t) + 3} textAnchor="end" className={tickText}>{t}%</text>
          </g>
        ))}
        <line x1={L} x2={L} y1={T} y2={H - B} className="stroke-foreground/50" />
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="stroke-foreground/50" />
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className={tickText}>Field goal attempts per 20</text>
        <text transform={`translate(10 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className={tickText}>True shooting %</text>
        {data.map((d) => (
          <g key={d.player.id} className="cursor-pointer" onClick={() => onOpen(d.player.id)}>
            <title>{`${d.player.name}: ${d.volume.toFixed(1)} FGA/20, ${d.ts}% TS`}</title>
            <PhotoDot id={d.player.id} cx={x(d.volume)} cy={y(d.ts)} />
            <text x={x(d.volume)} y={y(d.ts) - 15} textAnchor="middle" className="fill-foreground text-[10px] font-semibold">
              {d.player.name}
            </text>
          </g>
        ))}
      </svg>
    </Frame>
  )
}

/* ---------- TS% by Shot Distance: one bar per zone on a shared percentage scale ---------- */
export function TsByZone() {
  const zones = computeLeagueTsByZone() as { key: string; label: string; fga: number; ts: number | null }[]
  if (zones.every((z) => z.fga === 0)) return <p className="text-sm text-muted-foreground">No field goals with a marked shot location yet.</p>
  const W = 420
  const H = 250
  const L = 40
  const R = 12
  const T = 22
  const B = 48
  const ay = axis(0, Math.max(100, ...zones.map((z) => z.ts ?? 0)), 4)
  const y = (v: number) => H - B - ((v - ay.lo) / (ay.hi - ay.lo)) * (H - T - B)
  const slot = (W - L - R) / zones.length
  const barW = Math.min(56, slot * 0.6)
  return (
    <Frame>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="True shooting percentage by shot distance">
        {ay.ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-foreground/50" : "stroke-border"} />
            <text x={L - 5} y={y(t) + 3} textAnchor="end" className={tickText}>{t}%</text>
          </g>
        ))}
        {zones.map((z, i) => {
          const cx = L + slot * i + slot / 2
          const top = y(z.ts ?? 0)
          return (
            <g key={z.key}>
              <title>{`${z.label}: ${z.ts === null ? "no data" : `${z.ts}% TS`} (${z.fga} attempt${z.fga === 1 ? "" : "s"})`}</title>
              {z.ts !== null && <rect x={cx - barW / 2} y={top} width={barW} height={y(0) - top} rx={3} className="fill-chart-2" />}
              <text x={cx} y={(z.ts === null ? y(0) : top) - 5} textAnchor="middle" className="fill-foreground text-[11px] font-bold">
                {z.ts === null ? "-" : `${z.ts}%`}
              </text>
              <text x={cx} y={H - B + 14} textAnchor="middle" className={tickText}>{z.label}</text>
              <text x={cx} y={H - B + 27} textAnchor="middle" className={tickText}>{z.fga} att.</text>
            </g>
          )
        })}
      </svg>
    </Frame>
  )
}
