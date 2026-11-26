import type { Metrics } from "@/lib/scouting"

// "Plays like": each player's style matched to a well-known NBA player's. Eight traits, each measured against the league here (how far
// above or below the middle, in spreads, clipped at 2): scoring, passing, rebounding, defense (steals, blocks and opponents' shooting),
// range (share of shots from 3), the rim (share of close shots), efficiency and making their own shot (shots off a beaten defender).
// The NBA players are described on the same traits by hand. A player gets the closest match by the angle between the two (so style
// counts, not volume), and no two players get the same one (the closest pairs are handed out first) unless that leaves a player below WEAK. Needs MIN_GAMES and MIN_SHOTS.
export const MIN_GAMES = 3
export const MIN_SHOTS = 15
export const WEAK = 0.3 // below this closeness no comparison is shown

const TRAITS = ["scoring", "passing", "rebounding", "defense", "range", "rim", "efficiency", "creation"] as const
type Trait = (typeof TRAITS)[number]
type Profile = Partial<Record<Trait, number>>

const SAY: Record<Trait, string> = {
  scoring: "scores in bunches",
  passing: "sets everyone up",
  rebounding: "owns the glass",
  defense: "makes every shot hard",
  range: "lives behind the line",
  rim: "goes straight at the rim",
  efficiency: "rarely wastes a shot",
  creation: "makes their own shot",
}

export const NBA: { name: string; p: Profile }[] = [
  { name: "Stephen Curry", p: { scoring: 1, range: 1, efficiency: 0.9, passing: 0.4, rim: -0.6 } },
  { name: "Klay Thompson", p: { range: 1, scoring: 0.5, efficiency: 0.6, defense: 0.3, passing: -0.5, creation: -0.6 } },
  { name: "LeBron James", p: { scoring: 0.8, passing: 1, rebounding: 0.6, rim: 0.6, creation: 0.5 } },
  { name: "Chris Paul", p: { passing: 1, defense: 0.6, efficiency: 0.4, creation: 0.3, rim: -0.5 } },
  { name: "Rajon Rondo", p: { passing: 1, defense: 0.4, rebounding: 0.3, scoring: -0.6, range: -0.7 } },
  { name: "Giannis Antetokounmpo", p: { rim: 1, scoring: 0.8, rebounding: 0.8, defense: 0.5, range: -0.9 } },
  { name: "Shaquille O'Neal", p: { rim: 1, rebounding: 1, efficiency: 0.7, scoring: 0.6, range: -1, passing: -0.5 } },
  { name: "Dennis Rodman", p: { rebounding: 1, defense: 0.8, scoring: -1, range: -0.5, creation: -0.6 } },
  { name: "Draymond Green", p: { defense: 1, passing: 0.8, rebounding: 0.5, scoring: -0.6, creation: -0.4 } },
  { name: "Kawhi Leonard", p: { defense: 1, scoring: 0.6, efficiency: 0.6, creation: 0.5 } },
  { name: "James Harden", p: { creation: 1, scoring: 0.9, passing: 0.7, range: 0.6 } },
  { name: "Kyrie Irving", p: { creation: 1, scoring: 0.7, efficiency: 0.4, rim: 0.2, rebounding: -0.5 } },
  { name: "Russell Westbrook", p: { passing: 0.7, rebounding: 0.7, scoring: 0.6, rim: 0.6, efficiency: -0.6 } },
  { name: "Dirk Nowitzki", p: { scoring: 0.7, efficiency: 0.6, range: 0.5, rebounding: 0.3, rim: -0.5, passing: -0.3 } },
  { name: "Ben Wallace", p: { defense: 1, rebounding: 0.8, scoring: -1, creation: -0.6 } },
  { name: "Nikola Jokic", p: { passing: 1, rebounding: 0.8, efficiency: 0.8, scoring: 0.6, creation: -0.2 } },
  { name: "Dwyane Wade", p: { rim: 0.8, scoring: 0.8, creation: 0.6, defense: 0.4, range: -0.6 } },
  { name: "Shane Battier", p: { defense: 0.6, efficiency: 0.5, range: 0.5, scoring: -0.6, creation: -0.6 } },
  { name: "Jamal Crawford", p: { creation: 0.9, scoring: 0.6, range: 0.5, defense: -0.6, passing: -0.2 } },
  { name: "Kevin Durant", p: { scoring: 1, efficiency: 0.8, range: 0.4, creation: 0.4, defense: 0.3 } },
  { name: "Steve Nash", p: { passing: 1, efficiency: 0.9, range: 0.5, defense: -0.6 } },
  { name: "Tim Duncan", p: { rebounding: 0.8, defense: 0.8, rim: 0.6, efficiency: 0.5, creation: -0.4 } },
]

const lean = (m: Metrics): Record<Trait, number | null> => ({
  scoring: m.pts,
  passing: m.ast,
  rebounding: m.reb,
  defense: m.oppFg === null ? m.stl + m.blk : m.stl + m.blk - m.oppFg * 4, // fewer made against them counts like a steal or so
  range: m.lineShare === null && m.deepShare === null ? null : (m.lineShare ?? 0) + (m.deepShare ?? 0),
  rim: m.rimShare,
  efficiency: m.fgNoBeat ?? m.fg,
  creation: m.beatShare,
})

export interface Comp {
  id: string
  name: string
  why: string // e.g. "sets everyone up and makes every shot hard"; empty when no trait stands out
  match: number // 0..1, how close
}

export function nbaComps(all: Metrics[]): Map<string, Comp> {
  const pool = all.filter((m) => m.games >= MIN_GAMES && m.shots >= MIN_SHOTS)
  if (pool.length < 4) return new Map()
  const raw = pool.map((m) => ({ id: m.id, v: lean(m) }))
  const z = new Map<string, Record<Trait, number>>()
  const stats = TRAITS.map((t) => {
    const xs = raw.map((r) => r.v[t]).filter((x): x is number => x !== null)
    const mean = xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length || 1)) || 1
    return { mean, sd }
  })
  for (const r of raw) {
    const out = {} as Record<Trait, number>
    TRAITS.forEach((t, i) => {
      const x = r.v[t]
      out[t] = x === null ? 0 : Math.max(-2, Math.min(2, (x - stats[i].mean) / stats[i].sd)) / 2
    })
    z.set(r.id, out)
  }
  const cos = (a: Record<Trait, number>, b: Profile) => {
    let d = 0
    let na = 0
    let nb = 0
    for (const t of TRAITS) {
      const y = b[t] ?? 0
      d += a[t] * y
      na += a[t] ** 2
      nb += y ** 2
    }
    return na && nb ? d / Math.sqrt(na * nb) : 0
  }
  const pairs: { id: string; k: number; s: number }[] = []
  for (const [id, v] of z) NBA.forEach((n, k) => pairs.push({ id, k, s: cos(v, n.p) }))
  pairs.sort((a, b) => b.s - a.s || a.id.localeCompare(b.id) || a.k - b.k)
  const out = new Map<string, Comp>()
  const used = new Set<number>()
  const best = new Map<string, (typeof pairs)[number]>()
  for (const p of pairs) if (!best.has(p.id)) best.set(p.id, p)
  const chosen = new Map<string, (typeof pairs)[number]>()
  for (const p of pairs) {
    if (chosen.has(p.id) || used.has(p.k)) continue
    used.add(p.k)
    chosen.set(p.id, p)
  }
  // A weak unique pick gives way to the player's own closest match, shared or not; a weak match shows nothing.
  for (const [id, p] of chosen) {
    const b = best.get(id)!
    const use = p.s < WEAK && b.s > p.s ? b : p
    if (use.s < WEAK) continue
    const k = use.k
    const v = z.get(id)!
    const n = NBA[k]
    const shared = TRAITS.filter((t) => (n.p[t] ?? 0) > 0.3 && v[t] > 0.1).sort((a, b) => v[b] * (n.p[b] ?? 0) - v[a] * (n.p[a] ?? 0))
    const top = shared.slice(0, 2)
    out.set(id, { id, name: n.name, why: top.map((t) => SAY[t]).join(" and "), match: use.s })
  }
  return out
}
