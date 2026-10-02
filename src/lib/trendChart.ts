import { axis } from "./axis"

export interface TrendPoint {
  date: string
  value: number
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

// The game-by-game line chart behind every "trend" panel on the Player page (Stat Trend, Two-Way
// Trend, Teammate Quality, matchup difficulty). Returns SVG markup for the classic code to place:
// evenly spaced games, a stepped value axis, the season average dashed in the text color and the
// league average dashed in grey. The latest game is the accent dot. `faded` is the classic rule
// for fewer than five games, where the line is too short to read as a trend.
export function trendChartHtml(
  points: TrendPoint[],
  seasonAvg: number | null,
  unit: string,
  leagueAvg: number | null | undefined,
  opts: { decimals?: number; faded?: boolean } | undefined,
  fmtDate: (d: string) => string,
): string {
  const dec = opts?.decimals ?? 1
  if (points.length === 0 || seasonAvg === null) return '<p class="empty-state">Not enough data yet.</p>'
  const hasLeague = leagueAvg !== undefined && leagueAvg !== null
  const W = 560
  const H = 240
  const L = 46
  const R = 16
  const T = 18
  const B = 40
  const vals = [...points.map((p) => p.value), seasonAvg, ...(hasLeague ? [leagueAvg as number] : [])]
  const ay = axis(Math.min(...vals), Math.max(...vals), 4)
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i / (points.length - 1)) * (W - L - R))
  const y = (v: number) => H - B - ((v - ay.lo) / (ay.hi - ay.lo)) * (H - T - B)
  const every = Math.max(1, Math.ceil(points.length / 7))
  const text = "fill-muted-foreground text-[10px]"
  const grid = ay.ticks
    .map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="stroke-border"/><text x="${L - 5}" y="${y(t) + 3}" text-anchor="end" class="${text}">${Number(t.toFixed(dec))}</text>`)
    .join("")
  const cols = points
    .map((p, i) =>
      i % every !== 0 && i !== points.length - 1
        ? ""
        : `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}" class="stroke-border"/><text x="${x(i)}" y="${H - B + 14}" text-anchor="middle" class="${text}">${esc(fmtDate(p.date))}</text>`,
    )
    .join("")
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ")
  const last = points.length - 1
  const dots = points
    .map(
      (p, i) =>
        `<circle cx="${x(i)}" cy="${y(p.value)}" r="${i === last ? 5 : 3.5}" class="${i === last ? "fill-primary" : "fill-foreground/70"} stroke-card" stroke-width="2"><title>${esc(fmtDate(p.date))}: ${p.value.toFixed(dec)} ${esc(unit)}</title></circle>`,
    )
    .join("")
  const ref = (v: number, label: string, cls: string, anchor: "start" | "end") =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke-dasharray="5 4" class="${cls}"><title>${esc(label)} ${v.toFixed(dec)} ${esc(unit)}</title></line><text x="${anchor === "end" ? W - R : L + 4}" y="${y(v) - 4}" text-anchor="${anchor}" class="${text}">${esc(label)} ${v.toFixed(dec)}</text>`
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full rounded-xl border bg-card p-1" role="img" aria-label="${esc(unit)} by game"><g class="${opts?.faded ? "opacity-50" : ""}">${grid}${cols}${ref(seasonAvg, "season avg", "stroke-foreground/60", "end")}${hasLeague ? ref(leagueAvg as number, "league avg", "stroke-muted-foreground/60", "start") : ""}<path d="${line}" class="fill-none stroke-primary" stroke-width="2.5" stroke-linejoin="round"/>${dots}</g></svg>`
}
