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
