import { heatFill } from "./heat"

interface Cell {
  x: number
  y: number
  w: number
  h: number
  attempts: number
  makes: number
}

// The half-court zone map behind the Player page's Shot Heatmap and Defensive Heatmap. Each zone is
// tinted against that player's own overall FG% (aqua above, crimson below, darker with more
// attempts). For the defensive map `invert` flips it, since a low opponent FG% is the good result.
export function heatmapHtml(cells: Cell[], total: number, invert: boolean): string {
  const W = 300
  const H = 360
  const P = 8
  const X = (v: number) => P + (v / 100) * (W - P * 2)
  const Y = (v: number) => H - P - (v / 100) * (H - P * 2)
  const made = cells.reduce((s, c) => s + c.makes, 0)
  const mean = total ? made / total : 0
  const rows = [...new Set(cells.map((c) => c.y).filter((y) => y > 0))]
  const lines =
    rows.map((y) => `<line x1="${P}" x2="${W - P}" y1="${Y(y)}" y2="${Y(y)}" class="stroke-border"/>`).join("") +
    [20, 40, 60, 80].map((c) => `<line x1="${X(c)}" x2="${X(c)}" y1="${P}" y2="${H - P}" class="stroke-border"/>`).join("")
  const body = cells
    .filter((c) => c.attempts > 0)
    .map((c) => {
      const fg = c.makes / c.attempts
      const pct = Math.round(fg * 100)
      const cx = X(c.x + c.w / 2)
      const cy = (Y(c.y) + Y(c.y + c.h)) / 2
      return `<g><title>${c.makes} of ${c.attempts} ${invert ? "allowed" : "made"} (${pct}%)</title><rect x="${X(c.x) + 1}" y="${Y(c.y + c.h) + 1}" width="${X(c.x + c.w) - X(c.x) - 2}" height="${Y(c.y) - Y(c.y + c.h) - 2}" rx="2" style="fill:${heatFill(invert ? mean : fg, invert ? fg : mean, 0.35, c.attempts, 8)}"/><text x="${cx}" y="${cy - 1}" text-anchor="middle" class="fill-foreground text-[11px] font-bold">${c.attempts}</text><text x="${cx}" y="${cy + 10}" text-anchor="middle" class="fill-foreground/70 text-[9px]">${pct}%</text></g>`
    })
    .join("")
  const legend = invert
    ? `<span class="flex items-center gap-1.5"><span class="size-3 rounded-sm bg-pos"></span>Held below their average</span><span class="flex items-center gap-1.5"><span class="size-3 rounded-sm bg-neg"></span>Allowed above</span>`
    : `<span class="flex items-center gap-1.5"><span class="size-3 rounded-sm bg-pos"></span>Above their average (${Math.round(mean * 100)}% FG)</span><span class="flex items-center gap-1.5"><span class="size-3 rounded-sm bg-neg"></span>Below</span>`
  return `<div class="mx-auto w-full max-w-sm"><div class="rounded-xl border bg-card p-2"><svg viewBox="0 0 ${W} ${H}" class="w-full" role="img" aria-label="${invert ? "Defensive" : "Shot"} heat map by court zone"><rect x="${P}" y="${P}" width="${W - P * 2}" height="${H - P * 2}" rx="4" class="fill-none stroke-foreground/40"/>${lines}<circle cx="${W / 2}" cy="${Y(7)}" r="5" class="fill-none stroke-foreground/50" stroke-width="2"/>${body}<line x1="${P}" x2="${W - P}" y1="${Y(60)}" y2="${Y(60)}" stroke-dasharray="4 3" class="stroke-foreground/50"/><text x="${W - P - 3}" y="${Y(60) - 3}" text-anchor="end" class="fill-muted-foreground text-[9px] font-semibold">3PT</text></svg></div><div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">${legend}<span>Bold number is attempts</span></div></div>`
}
