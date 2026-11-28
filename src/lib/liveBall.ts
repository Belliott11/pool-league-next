import { PREGAME_WEIGHT_LIVE } from "@/lib/live"
import { tripRates } from "@/lib/shotChoice"
import type { PooleanState } from "@/lib/types"
import { WIN_BY, gameOver } from "@/lib/race"

// The live odds with the ball in them: the same pre-game read at the same weight as live.ts (PREGAME_WEIGHT_LIVE) and the same idea of
// learning from the game, but a race that knows who has the ball. Each trip, the team with the ball scores a 2 or a 3 or comes away
// empty, and the ball changes hands (an offensive rebound is the same trip going on). So a turnover or a miss out of bounds moves the
// odds even with no points. The teams differ in how often a trip scores: the pre-game read sets that gap, and the trips of this game
// move it, leaning on the read by PRIOR_TRIPS trips each.

export interface BallRates {
  p: number // the league's chance a trip scores
  share3: number // of the trips that score, the share that are 3s
}

// The league's trip rates, from every filmed game (shotChoice.ts tripRates).
export function ballRates(state: PooleanState): BallRates {
  const { t2, t3 } = tripRates(state)
  return { p: t2 + t3, share3: t2 + t3 > 0 ? t3 / (t2 + t3) : 0.18 }
}

// W(a, b, ballA): A's chance to win at a to b, A with the ball or not, first to `target`, win by 2. A trip scores with chance pA for A
// and pB for B. Past the point where only the margin matters, scores are folded together, and the table is solved by repeating the
// update until it settles (the win-by-2 margins and the empty trips feed each other in loops). Kept per rounded rate pair.
const tables = new Map<string, (a: number, b: number, ballA: boolean) => number>()
export function ballOdds(target: number, pA: number, pB: number, share3: number): (a: number, b: number, ballA: boolean) => number {
  const ra = Math.round(pA * 400) / 400
  const rb = Math.round(pB * 400) / 400
  const key = `${target}|${ra}|${rb}|${share3.toFixed(3)}`
  const kept = tables.get(key)
  if (kept) return kept
  const floor = target - WIN_BY + 1
  const fold = (a: number, b: number): [number, number] => {
    const m = Math.min(a, b)
    return m > floor ? [a - (m - floor), b - (m - floor)] : [a, b]
  }
  const size = target + 4
  const idx = (a: number, b: number, o: number) => (a * size + b) * 2 + o
  const v = new Float64Array(size * size * 2).fill(0.5)
  const at = (x: number, y: number, o: number): number => {
    if (gameOver(x, y, target)) return x > y ? 1 : 0
    const [a, b] = fold(x, y)
    return v[idx(a, b, o)]
  }
  const a2 = ra * (1 - share3), a3 = ra * share3, a0 = 1 - ra
  const b2 = rb * (1 - share3), b3 = rb * share3, b0 = 1 - rb
  for (let it = 0; it < 5000; it++) {
    let moved = 0
    for (let a = size - 1; a >= 0; a--)
      for (let b = size - 1; b >= 0; b--) {
        if (gameOver(a, b, target)) continue
        const [fa, fb] = fold(a, b)
        if (fa !== a || fb !== b) continue
        // o = 1: A has the ball. After A's trip the ball is B's (o = 0), and the other way round.
        const withA = a2 * at(a + 2, b, 0) + a3 * at(a + 3, b, 0) + a0 * at(a, b, 0)
        const withB = b2 * at(a, b + 2, 1) + b3 * at(a, b + 3, 1) + b0 * at(a, b, 1)
        moved = Math.max(moved, Math.abs(v[idx(a, b, 1)] - withA), Math.abs(v[idx(a, b, 0)] - withB))
        v[idx(a, b, 1)] = withA
        v[idx(a, b, 0)] = withB
      }
    if (moved < 1e-10) break
  }
  const f = (a: number, b: number, ballA: boolean) => at(a, b, ballA ? 1 : 0)
  if (tables.size > 3000) tables.clear()
  tables.set(key, f)
  return f
}

// The gap in trip scoring that makes A's chance at the tip (who has the ball unknown, so the two cases averaged) equal `pre`.
const gaps = new Map<string, number>()
export function gapFor(target: number, pre: number, r: BallRates): number {
  const key = `${target}|${pre.toFixed(4)}|${r.p.toFixed(4)}|${r.share3.toFixed(3)}`
  const kept = gaps.get(key)
  if (kept !== undefined) return kept
  const room = Math.min(r.p, 1 - r.p) * 0.95
  let lo = -room
  let hi = room
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    const W = ballOdds(target, r.p + mid, r.p - mid, r.share3)
    if ((W(0, 0, true) + W(0, 0, false)) / 2 < pre) lo = mid
    else hi = mid
  }
  const d = (lo + hi) / 2
  if (gaps.size > 2000) gaps.clear()
  gaps.set(key, d)
  return d
}

// How many trips of evidence the pre-game read is worth before this game's own trips move each team's scoring rate.
export const PRIOR_TRIPS = 50

export interface Trips {
  tripsA: number
  scoredA: number // trips that ended in a basket
  tripsB: number
  scoredB: number
}

// A's chance to win at a to b, with the ball A's, B's, or unknown (null: the two cases averaged).
export function winProbabilityWithBall(a: number, b: number, target: number, pregameA: number | null, ball: "A" | "B" | null, r: BallRates, t: Trips = { tripsA: 0, scoredA: 0, tripsB: 0, scoredB: 0 }, prior = PRIOR_TRIPS): number {
  if (gameOver(a, b, target)) return a > b ? 0.99 : 0.01
  const pre = Math.min(0.97, Math.max(0.03, 0.5 + PREGAME_WEIGHT_LIVE * ((pregameA ?? 0.5) - 0.5)))
  const gap = gapFor(target, pre, r)
  const clamp = (x: number) => Math.min(0.95, Math.max(0.05, x))
  const pA = clamp((prior * (r.p + gap) + t.scoredA) / (prior + t.tripsA))
  const pB = clamp((prior * (r.p - gap) + t.scoredB) / (prior + t.tripsB))
  const W = ballOdds(target, pA, pB, r.share3)
  const p = ball === "A" ? W(a, b, true) : ball === "B" ? W(a, b, false) : (W(a, b, true) + W(a, b, false)) / 2
  return Math.min(0.99, Math.max(0.01, p))
}
