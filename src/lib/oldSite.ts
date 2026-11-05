import { currentRealSeason } from "@/lib/real"

// What the old site knows that the app's own games do not: every result (most games were never filmed or scored shot by
// shot) and its nightly power rankings. Both are per player and in date order.
export interface OldSite {
  wins: Map<string, boolean[]> // one entry per game, true for a win
  ranks: Map<string, number[]> // power ranking percentile (0 to 100) on each night they were ranked
  power: Map<string, number> // season power percentile, pulled toward 50 for players with few games
}

export const EMPTY_OLD: OldSite = { wins: new Map(), ranks: new Map(), power: new Map() }

const SHRINK = 5 // a player's power counts as five games of 50 before their own games count

export interface Pair {
  id: string
  w: number
  l: number
}

// A player's whole record on the old site, from its season card (which counts every game), else from the results list.
export function oldRecord(id: string): { w: number; l: number } | null {
  const c = currentRealSeason()?.cards[id]
  if (c && c.w !== undefined && c.l !== undefined && c.w + c.l > 0) return { w: c.w, l: c.l }
  const w = oldSite().wins.get(id)
  return w && w.length > 0 ? { w: w.filter(Boolean).length, l: w.filter((x) => !x).length } : null
}

const shrunk = (p: Pair) => (p.w + 2.5) / (p.w + p.l + 5)
const MIN_TOGETHER = 5
const MIN_AGAINST = 5

// Best partner (record together pulled toward even, as the duo award) and most played opponent (closest record breaking
// ties), from the old site's pair records. Each needs at least 5 games.
export function oldPairs(id: string): { mate: Pair | null; rival: Pair | null } {
  const s = currentRealSeason()
  const mates: Pair[] = []
  const rivals: Pair[] = []
  for (const [k, r] of Object.entries(s?.together ?? {})) {
    const [a, b] = k.split("|")
    if ((a === id || b === id) && r.gp >= MIN_TOGETHER) mates.push({ id: a === id ? b : a, w: r.w, l: r.l ?? r.gp - r.w })
  }
  for (const [k, r] of Object.entries(s?.against ?? {})) {
    const [a, b] = k.split("|")
    if (a === id && r.gp >= MIN_AGAINST) rivals.push({ id: b, w: r.w, l: r.l ?? r.gp - r.w })
  }
  return {
    mate: mates.sort((x, y) => shrunk(y) - shrunk(x) || y.w + y.l - (x.w + x.l))[0] ?? null,
    rival: rivals.sort((x, y) => y.w + y.l - (x.w + x.l) || Math.abs(x.w - x.l) - Math.abs(y.w - y.l))[0] ?? null,
  }
}

let cached: OldSite | null = null
export function oldSite(): OldSite {
  if (cached) return cached
  const s = currentRealSeason()
  if (!s) return (cached = EMPTY_OLD)
  const wins = new Map<string, boolean[]>()
  for (const g of [...s.games].sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n)) {
    for (const [ids, won] of [[g.a, g.w === "A"], [g.b, g.w === "B"]] as const) for (const id of ids) wins.set(id, [...(wins.get(id) ?? []), won])
  }
  const ranks = new Map<string, number[]>()
  for (const r of [...s.rankings].sort((a, b) => a.date.localeCompare(b.date))) for (const p of r.players) ranks.set(p.slug, [...(ranks.get(p.slug) ?? []), p.pct])
  const power = new Map<string, number>()
  for (const [id, c] of Object.entries(s.cards)) {
    const gp = (c.w ?? 0) + (c.l ?? 0) || (wins.get(id)?.length ?? 0)
    power.set(id, (c.powerPct * gp + 50 * SHRINK) / (gp + SHRINK))
  }
  return (cached = { wins, ranks, power })
}
