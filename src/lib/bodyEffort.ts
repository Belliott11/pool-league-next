import { compareRates, type Comparison, type Rate } from "@/lib/gameFlow"
import { games } from "@/lib/insight"
import { PER } from "@/lib/per"
import { getGameStats } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"
import { winImpact, type WinImpact } from "@/lib/winImpact"

// Whether size and effort show up in the numbers. Height is a measurement; build and effort are the league's own ratings.
export const TRAITS = ["heightIn", "build", "effort"] as const
export type Trait = (typeof TRAITS)[number]
export const TRAIT_LABEL: Record<Trait, string> = { heightIn: "Height", build: "Build", effort: "Effort" }
export const OUTCOMES = ["rebounds", "distance", "stops", "impact"] as const
export type Outcome = (typeof OUTCOMES)[number]
export const OUTCOME_LABEL: Record<Outcome, string> = { rebounds: `Rebounds per ${PER}`, distance: "Shot distance", stops: "Stops per defended shot", impact: "Adjusted win impact" }

type Physical = Partial<Record<Trait, number>>
export type Sure = "clear" | "hint" | "early"
export interface Cell {
  n: number
  rho: number | null
  p: number | null
  sure: Sure
}
export const MIN_PLAYERS = 8
const CLOSE = 1 // inches either way that count as the same height

const rank = (a: number[]) => {
  const o = a.map((v, i) => [v, i] as const).sort((x, y) => x[0] - y[0])
  const r = new Array<number>(a.length)
  for (let i = 0; i < o.length; ) {
    let j = i
    while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++
    for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2
    i = j + 1
  }
  return r
}
const pearson = (x: number[], y: number[]) => {
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
  const [mx, my] = [mean(x), mean(y)]
  let n = 0
  let a = 0
  let b = 0
  for (let i = 0; i < x.length; i++) {
    n += (x[i] - mx) * (y[i] - my)
    a += (x[i] - mx) ** 2
    b += (y[i] - my) ** 2
  }
  return a && b ? n / Math.sqrt(a * b) : 0
}
export function correlate(x: number[], y: number[]): Cell {
  if (x.length < MIN_PLAYERS) return { n: x.length, rho: null, p: null, sure: "early" }
  const [rx, ry] = [rank(x), rank(y)]
  const rho = pearson(rx, ry)
  let seed = 23
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  let hits = 0
  const N = 2000
  for (let i = 0; i < N; i++) {
    const p = [...ry]
    for (let j = p.length - 1; j > 0; j--) {
      const k = Math.floor(rnd() * (j + 1))
      ;[p[j], p[k]] = [p[k], p[j]]
    }
    if (Math.abs(pearson(rx, p)) >= Math.abs(rho)) hits++
  }
  const p = (hits + 1) / (N + 1)
  return { n: x.length, rho, p, sure: p < 0.01 ? "clear" : p < 0.05 ? "hint" : "early" }
}

export interface HeightBucket {
  shooterTaller: Rate
  even: Rate
  shooterShorter: Rate
  tallerVsShorter: Comparison
}
export interface BodyEffort {
  grid: Record<Trait, Record<Outcome, Cell>>
  league: HeightBucket
  rows: { id: string; shooterTaller: Rate; even: Rate; shooterShorter: Rate }[]
}

export function bodyEffort(state: PooleanState, impact: WinImpact = winImpact(state)): BodyEffort {
  const phys = (state.playerPhysicalOverrides ?? {}) as Record<string, Physical>
  const gs = games(state)
  const by = new Map<string, { reb: number; pts: number; dist: number; shots: number; stops: number; guarded: number }>()
  const row = (id: string) => by.get(id) ?? by.set(id, { reb: 0, pts: 0, dist: 0, shots: 0, stops: 0, guarded: 0 }).get(id)!
  const fresh = () => ({ shooterTaller: { made: 0, att: 0 }, even: { made: 0, att: 0 }, shooterShorter: { made: 0, att: 0 } })
  const league = fresh()
  const each = new Map<string, ReturnType<typeof fresh>>()
  for (const g of gs) {
    const total = g.scoringEvents.reduce((n, e) => n + (e.made !== false ? e.points : 0), 0)
    for (const id of [...g.teamA, ...g.teamB]) {
      const s = getGameStats(g, id)
      const r = row(id)
      r.reb += s.oreb + s.dreb
      r.pts += total
    }
    for (const e of g.scoringEvents) {
      if (e.shotLocation) {
        const r = row(e.scorerId)
        r.dist += Math.hypot(e.shotLocation.x - 50, e.shotLocation.y)
        r.shots++
      }
      const on = e.defenderIds ?? []
      for (const d of on) {
        row(d).guarded++
        if (e.made === false && e.contestLevel !== "beat") row(d).stops++ // a miss off a beaten defender is not a stop
      }
      const mine = phys[e.scorerId]?.heightIn
      const theirs = on.map((d) => phys[d]?.heightIn).filter((h): h is number => typeof h === "number")
      if (typeof mine !== "number" || theirs.length === 0) continue
      const gap = mine - theirs.reduce((a, b) => a + b, 0) / theirs.length
      const key = gap > CLOSE ? "shooterTaller" : gap < -CLOSE ? "shooterShorter" : "even"
      const pl = each.get(e.scorerId) ?? each.set(e.scorerId, fresh()).get(e.scorerId)!
      for (const b of [league[key], pl[key]]) {
        b.att++
        if (e.made !== false) b.made++
      }
    }
  }
  const impacts = new Map(impact.rows.filter((r) => r.games >= 3).map((r) => [r.id, r.impact]))
  const value = (id: string, o: Outcome): number | null => {
    const r = by.get(id)
    if (o === "impact") return impacts.get(id) ?? null
    if (!r) return null
    if (o === "rebounds") return r.pts ? (r.reb / r.pts) * PER : null
    if (o === "distance") return r.shots >= 5 ? r.dist / r.shots : null
    return r.guarded >= 5 ? r.stops / r.guarded : null
  }
  const grid = Object.fromEntries(
    TRAITS.map((t) => [
      t,
      Object.fromEntries(
        OUTCOMES.map((o) => {
          const pairs = state.players.flatMap((p) => {
            const a = phys[p.id]?.[t]
            const b = value(p.id, o)
            return typeof a === "number" && b !== null ? [[a, b] as const] : []
          })
          return [o, correlate(pairs.map((x) => x[0]), pairs.map((x) => x[1]))]
        }),
      ),
    ]),
  ) as Record<Trait, Record<Outcome, Cell>>
  return {
    grid,
    league: { ...league, tallerVsShorter: compareRates(league.shooterShorter, league.shooterTaller) },
    rows: [...each].map(([id, b]) => ({ id, ...b })).sort((a, b) => b.shooterTaller.att + b.even.att + b.shooterShorter.att - (a.shooterTaller.att + a.even.att + a.shooterShorter.att)),
  }
}
