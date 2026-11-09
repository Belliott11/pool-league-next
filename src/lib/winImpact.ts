import type { Rate } from "@/lib/gameFlow"
import { currentRealSeason } from "@/lib/real"
import { shootingStats } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// What each player does to a team's chance of winning with their teammates and opponents held constant: a ridge logistic
// regression over every result we have, most of which were never filmed. Each player is +1 on one side and -1 on the
// other, with no intercept, so which team was typed in as A cannot matter.
export interface Result {
  a: string[]
  b: string[]
  aWon: boolean
  night: string
}

const L2 = 0.05
const ITERS = 300
const RATE = 0.8
const sig = (z: number) => 1 / (1 + Math.exp(-z))
const finished = (g: Game) => !g.liveInProgress && !g.stoppedEarly && (g.winner === "A" || g.winner === "B")
const key = (date: string, a: string[], b: string[]) => `${date}|${[[...a].sort().join(), [...b].sort().join()].sort().join("|")}`

// Every old-site result, then finished app games the old site does not already have. Date order, then play order.
export function results(state: PooleanState, old = currentRealSeason()?.games ?? []): Result[] {
  const sorted = [...old].sort((x, y) => x.date.localeCompare(y.date) || x.n - y.n)
  const seen = new Set(sorted.map((g) => key(g.date, g.a, g.b)))
  const out: Result[] = sorted.map((g) => ({ a: g.a, b: g.b, aWon: g.w === "A", night: g.date }))
  for (const g of state.games) if (finished(g) && !seen.has(key(g.date, g.teamA, g.teamB))) out.push({ a: g.teamA, b: g.teamB, aWon: g.winner === "A", night: g.date })
  return out
}

interface Fit {
  w: Map<string, number>
  size: number
}

export function fit(rows: Result[]): Fit {
  const ids = [...new Set(rows.flatMap((r) => [...r.a, ...r.b]))]
  const at = new Map(ids.map((id, i) => [id, i]))
  const w = new Array(ids.length).fill(0)
  let size = 0
  const n = rows.length || 1
  const xs = rows.map((r) => ({ a: r.a.map((i) => at.get(i)!), b: r.b.map((i) => at.get(i)!), d: r.a.length - r.b.length, y: r.aWon ? 1 : 0 }))
  for (let it = 0; it < ITERS; it++) {
    const g = new Array(ids.length).fill(0)
    let gs = 0
    for (const x of xs) {
      let z = x.d * size
      for (const i of x.a) z += w[i]
      for (const i of x.b) z -= w[i]
      const e = sig(z) - x.y
      for (const i of x.a) g[i] += e
      for (const i of x.b) g[i] -= e
      gs += e * x.d
    }
    for (let i = 0; i < w.length; i++) w[i] -= RATE * (g[i] / n + L2 * w[i])
    size -= RATE * (gs / n + L2 * size)
  }
  return { w: new Map(ids.map((id, i) => [id, w[i]])), size }
}

const predict = (f: Fit, r: Result) => sig((r.a.length - r.b.length) * f.size + r.a.reduce((n, i) => n + (f.w.get(i) ?? 0), 0) - r.b.reduce((n, i) => n + (f.w.get(i) ?? 0), 0))
const loss = (p: number, y: boolean) => -Math.log(Math.min(1 - 1e-9, Math.max(1e-9, y ? p : 1 - p)))

// Each night predicted from every other night: the model against a plain shrunk win rate. A coin flip scores 0.693.
export function validate(rows: Result[]): { model: number; baseline: number; games: number } {
  let model = 0
  let baseline = 0
  for (const night of new Set(rows.map((r) => r.night))) {
    const train = rows.filter((r) => r.night !== night)
    const f = fit(train)
    const rec = new Map<string, [number, number]>()
    for (const r of train)
      for (const [ids, won] of [[r.a, r.aWon], [r.b, !r.aWon]] as const)
        for (const id of ids) {
          const c = rec.get(id) ?? [0, 0]
          rec.set(id, [c[0] + (won ? 1 : 0), c[1] + 1])
        }
    const wr = (id: string) => ((rec.get(id)?.[0] ?? 0) + 2.5) / ((rec.get(id)?.[1] ?? 0) + 5)
    const avg = (ids: string[]) => ids.reduce((n, i) => n + wr(i), 0) / ids.length
    for (const r of rows.filter((x) => x.night === night)) {
      model += loss(predict(f, r), r.aWon)
      baseline += loss(sig(5 * (avg(r.a) - avg(r.b))), r.aWon)
    }
  }
  const n = rows.length || 1
  return { model: model / n, baseline: baseline / n, games: rows.length }
}

export type Sure = "clear" | "hint" | "early"
export interface Impact {
  id: string
  games: number
  impact: number // percentage points of win chance against an average player
  lo: number // 5th percentile of the resampled nights
  hi: number // 95th
  sure: Sure
}
export interface WinImpact {
  rows: Impact[]
  check: { model: number; baseline: number; games: number }
  nights: number
}

const RESAMPLES = 60
const pp = (w: number) => (sig(w) - 0.5) * 100

export function winImpact(state: PooleanState, old = currentRealSeason()?.games ?? []): WinImpact {
  const rows = results(state, old)
  const f = fit(rows)
  const nights = [...new Set(rows.map((r) => r.night))]
  const draws = new Map<string, number[]>()
  let seed = 19
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
  for (let i = 0; i < RESAMPLES; i++) {
    const pick = nights.map(() => nights[Math.floor(rnd() * nights.length)])
    const fb = fit(pick.flatMap((n) => rows.filter((r) => r.night === n)))
    for (const id of f.w.keys()) draws.set(id, [...(draws.get(id) ?? []), pp(fb.w.get(id) ?? 0)])
  }
  const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
  const games = new Map<string, number>()
  for (const r of rows) for (const id of [...r.a, ...r.b]) games.set(id, (games.get(id) ?? 0) + 1)
  const check = validate(rows)
  // A model that cannot beat plain win rate on new nights does not get to call anything clear.
  const proven = check.model < check.baseline
  return {
    nights: nights.length,
    check,
    rows: [...f.w]
      .map(([id, w]) => {
        const d = (draws.get(id) ?? [0]).sort((a, b) => a - b)
        const [lo, hi] = [q(d, 0.05), q(d, 0.95)]
        const sure: Sure = (lo > 0 || hi < 0) && proven ? "clear" : lo > 0 || hi < 0 || q(d, 0.2) > 0 || q(d, 0.8) < 0 ? "hint" : "early"
        return { id, games: games.get(id) ?? 0, impact: pp(w), lo, hi, sure }
      })
      .sort((a, b) => b.impact - a.impact),
  }
}

// Record, and shooting where there is a box score, by team size and by game number in a night.
export interface Bucket {
  w: number
  l: number
  shots: Rate
}
export const SIZES = ["2v2", "3v3", "Other"] as const
export type Size = (typeof SIZES)[number]
export interface Split {
  id: string
  size: Record<Size, Bucket>
  night: [Bucket, Bucket, Bucket] // first game, second, third or later
}
const sizeOf = (a: number, b: number): Size => (a === 2 && b === 2 ? "2v2" : a === 3 && b === 3 ? "3v3" : "Other")
const empty = (): Bucket => ({ w: 0, l: 0, shots: { made: 0, att: 0 } })

export function splits(state: PooleanState, old = currentRealSeason()?.games ?? []): Split[] {
  const by = new Map<string, Split>()
  const row = (id: string) => by.get(id) ?? by.set(id, { id, size: { "2v2": empty(), "3v3": empty(), Other: empty() }, night: [empty(), empty(), empty()] }).get(id)!
  const count = new Map<string, number>()
  for (const r of results(state, old)) {
    const n = Math.min(count.get(r.night) ?? 0, 2)
    count.set(r.night, (count.get(r.night) ?? 0) + 1)
    const s = sizeOf(r.a.length, r.b.length)
    for (const [ids, won] of [[r.a, r.aWon], [r.b, !r.aWon]] as const)
      for (const id of ids) {
        const x = row(id)
        for (const b of [x.size[s], x.night[n]]) won ? b.w++ : b.l++
      }
  }
  const boxed = state.games.filter((g) => !g.liveInProgress && g.scoringEvents.length > 0)
  const nth = new Map<string, number>()
  for (const g of [...boxed].sort((a, b) => a.date.localeCompare(b.date) || (a.videoStart ?? 0) - (b.videoStart ?? 0))) {
    const n = Math.min(nth.get(g.date) ?? 0, 2)
    nth.set(g.date, (nth.get(g.date) ?? 0) + 1)
    const s = sizeOf(g.teamA.length, g.teamB.length)
    for (const id of [...g.teamA, ...g.teamB]) {
      const sh = shootingStats(g, id)
      const x = row(id)
      for (const b of [x.size[s], x.night[n]]) {
        b.shots.made += sh.fgm
        b.shots.att += sh.fga
      }
    }
  }
  return [...by.values()]
}
