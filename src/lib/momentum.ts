import { CLEAR_Z, HINT_Z, type Verdict } from "@/lib/gameFlow"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// "Was that run real?" A run is a streak of baskets by one team. Momentum would show up as more long runs than chance gives, so every
// number here is compared with the same game's own baskets shuffled: the same number of baskets for each team, in a random order. That
// is the fair version of chance for one game (a team that scored more baskets will have longer runs anyway). The chances are worked out
// exactly, not by simulation, so they never change between visits. Shooting streaks (a make after a make) are checked the same way: each
// player's own shots in each game, shuffled.

export type Side = "A" | "B"
export const MIN_BASKETS = 8 // a game with fewer made baskets has too few runs to say anything

const made = (e: ScoringEvent) => e.made !== false

// The game's shots in the order they happened: by video time when every shot has one, otherwise as logged.
function inOrder(game: Game): ScoringEvent[] {
  const ev = game.scoringEvents
  if (ev.length && ev.every((e) => typeof e.videoTime === "number")) return [...ev].sort((a, b) => (a.videoTime as number) - (b.videoTime as number))
  return ev
}

export interface Basket {
  side: Side
  points: number
  scorerId: string
  a: number // score after this basket
  b: number
}

export function basketsOf(game: Game): Basket[] {
  let a = 0
  let b = 0
  const out: Basket[] = []
  for (const e of inOrder(game)) {
    if (!made(e)) continue
    const side: Side | null = game.teamA.includes(e.scorerId) ? "A" : game.teamB.includes(e.scorerId) ? "B" : null
    if (!side) continue
    if (side === "A") a += e.points
    else b += e.points
    out.push({ side, points: e.points, scorerId: e.scorerId, a, b })
  }
  return out
}

export interface Run {
  side: Side
  length: number // baskets
  points: number
  from: [number, number] // score before the run
  to: [number, number] // score after it
}

export function runsOf(baskets: Basket[]): Run[] {
  const runs: Run[] = []
  let prev: [number, number] = [0, 0]
  for (const k of baskets) {
    const last = runs.at(-1)
    if (last && last.side === k.side) {
      last.length++
      last.points += k.points
      last.to = [k.a, k.b]
    } else runs.push({ side: k.side, length: 1, points: k.points, from: prev, to: [k.a, k.b] })
    prev = [k.a, k.b]
  }
  return runs
}

// Chance that a random order of nA baskets for A and nB for B has no run of k or more (by either team). Counts the orders exactly:
// ways[a][b][side][len] is the number of orders of the first a + b baskets that end in a run of `len` by `side`, all runs under k.
function chanceAllUnder(nA: number, nB: number, k: number): number {
  if (k <= 1) return nA + nB === 0 ? 1 : 0
  const key = (a: number, b: number, s: number, l: number) => ((a * (nB + 1) + b) * 2 + s) * (k + 1) + l
  const ways = new Float64Array((nA + 1) * (nB + 1) * 2 * (k + 1))
  if (nA > 0) ways[key(1, 0, 0, 1)] = 1
  if (nB > 0) ways[key(0, 1, 1, 1)] = 1
  for (let a = 0; a <= nA; a++)
    for (let b = 0; b <= nB; b++)
      for (let s = 0; s < 2; s++)
        for (let l = 1; l < k; l++) {
          const w = ways[key(a, b, s, l)]
          if (!w) continue
          // Same team again: the run grows (only while it stays under k). Other team: a new run of 1.
          if (s === 0) {
            if (a < nA && l + 1 < k) ways[key(a + 1, b, 0, l + 1)] += w
            if (b < nB) ways[key(a, b + 1, 1, 1)] += w
          } else {
            if (b < nB && l + 1 < k) ways[key(a, b + 1, 1, l + 1)] += w
            if (a < nA) ways[key(a + 1, b, 0, 1)] += w
          }
        }
  let good = 0
  for (let s = 0; s < 2; s++) for (let l = 1; l < k; l++) good += ways[key(nA, nB, s, l)]
  return good / choose(nA + nB, nA)
}

function choose(n: number, k: number): number {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

// Chance that shuffling these baskets gives a run of k or more.
export const chanceRunAtLeast = (nA: number, nB: number, k: number): number => 1 - chanceAllUnder(nA, nB, k)

// The longest run chance gives on average for these baskets.
export function expectedLongest(nA: number, nB: number): number {
  let e = 0
  for (let k = 1; k <= Math.max(nA, nB); k++) e += chanceRunAtLeast(nA, nB, k)
  return e
}

// How many runs a shuffled order has on average, and how much that varies (the standard runs test).
export function runsChance(nA: number, nB: number): { mean: number; variance: number } {
  const n = nA + nB
  if (n < 2) return { mean: n, variance: 0 }
  const m = 2 * nA * nB
  return { mean: 1 + m / n, variance: (m * (m - n)) / (n * n * (n - 1)) }
}

export interface GameMomentum {
  game: Game
  baskets: number
  nA: number
  nB: number
  runs: number
  expectedRuns: number
  longest: Run
  chance: number // chance a shuffle of this game's baskets gives a run at least as long as `longest`
  expectedLongest: number
}

export function gameMomentum(game: Game): GameMomentum | null {
  const baskets = basketsOf(game)
  const nA = baskets.filter((k) => k.side === "A").length
  const nB = baskets.length - nA
  if (baskets.length < MIN_BASKETS || !nA || !nB) return null
  const runs = runsOf(baskets)
  // The longest run; on a tie in length, the one worth more points.
  const longest = runs.reduce((best, r) => (r.length > best.length || (r.length === best.length && r.points > best.points) ? r : best))
  return {
    game,
    baskets: baskets.length,
    nA,
    nB,
    runs: runs.length,
    expectedRuns: runsChance(nA, nB).mean,
    longest,
    chance: chanceRunAtLeast(nA, nB, longest.length),
    expectedLongest: expectedLongest(nA, nB),
  }
}

const verdictOf = (z: number): Verdict => (Math.abs(z) >= CLEAR_Z ? "clear" : Math.abs(z) >= HINT_Z ? "hint" : "early")

export interface StreakCheck {
  afterMake: { made: number; att: number }
  afterMiss: { made: number; att: number }
  // What shuffling each player's shots within each game gives, as the same two rates. This is the fair yardstick: better shooters take
  // more of the shots that follow a make, which lifts the after-make rate with no streak at all, while within one player's shots a make
  // used up as the "before" shot leaves one fewer to follow it, which lowers it. A real hot hand has to beat this gap, not zero.
  chanceAfterMake: number
  chanceAfterMiss: number
  gap: number // after a make minus after a miss, in percentage points
  chanceGap: number
  verdict: Verdict
}

export interface LeagueMomentum {
  games: GameMomentum[]
  runs: number
  expectedRuns: number
  runsZ: number
  runsVerdict: Verdict
  avgLongest: number
  avgExpectedLongest: number
  rare: number // games whose longest run chance gives 1 time in 10 or less
  streaks: StreakCheck | null
}

export function leagueMomentum(state: PooleanState): LeagueMomentum | null {
  const games = state.games
    .filter((g) => !g.liveInProgress)
    .map(gameMomentum)
    .filter((m): m is GameMomentum => m !== null)
  if (!games.length) return null
  let runs = 0
  let expectedRuns = 0
  let variance = 0
  for (const m of games) {
    runs += m.runs
    const c = runsChance(m.nA, m.nB)
    expectedRuns += c.mean
    variance += c.variance
  }
  // Fewer runs than chance means longer streaks; the z is positive when the games are streakier than chance.
  const runsZ = variance > 0 ? (expectedRuns - runs) / Math.sqrt(variance) : 0
  return {
    games,
    runs,
    expectedRuns,
    runsZ,
    runsVerdict: verdictOf(runsZ),
    avgLongest: games.reduce((s, m) => s + m.longest.length, 0) / games.length,
    avgExpectedLongest: games.reduce((s, m) => s + m.expectedLongest, 0) / games.length,
    rare: games.filter((m) => m.chance <= 0.1).length,
    streaks: streakCheck(state),
  }
}

// Makes after a make against makes after a miss, for every player's own shots within each game.
export function streakCheck(state: PooleanState): StreakCheck | null {
  const afterMake = { made: 0, att: 0 }
  const afterMiss = { made: 0, att: 0 }
  // Expected counts under a shuffle of one player's n shots with m makes: of the n - 1 shots that follow another, m(n-1)/n follow a
  // make, and m(m-1)/n of those are makes; (n-m)(n-1)/n follow a miss, and m(n-m)/n of those are makes.
  let eMakeAtt = 0
  let eMakeMade = 0
  let eMissAtt = 0
  let eMissMade = 0
  for (const g of state.games) {
    if (g.liveInProgress) continue
    const byPlayer = new Map<string, boolean[]>()
    // A finished game can only end on a make, so the basket that ends it is left out (as in gameFlow.ts).
    const shots = inOrder(g)
    const last = shots.at(-1)
    const counted = last && made(last) && !g.stoppedEarly && (g.winner === "A" || g.winner === "B") ? shots.slice(0, -1) : shots
    for (const e of counted) {
      const list = byPlayer.get(e.scorerId) ?? []
      list.push(made(e))
      byPlayer.set(e.scorerId, list)
    }
    for (const shots of byPlayer.values()) {
      const n = shots.length
      if (n < 2) continue
      for (let i = 1; i < n; i++) {
        const into = shots[i - 1] ? afterMake : afterMiss
        into.att++
        if (shots[i]) into.made++
      }
      const m = shots.filter(Boolean).length
      eMakeAtt += (m * (n - 1)) / n
      eMakeMade += (m * (m - 1)) / n
      eMissAtt += ((n - m) * (n - 1)) / n
      eMissMade += (m * (n - m)) / n
    }
  }
  if (!afterMake.att || !afterMiss.att || !eMakeAtt || !eMissAtt) return null
  const p1 = afterMake.made / afterMake.att
  const p2 = afterMiss.made / afterMiss.att
  const c1 = eMakeMade / eMakeAtt
  const c2 = eMissMade / eMissAtt
  const se = Math.sqrt((p1 * (1 - p1)) / afterMake.att + (p2 * (1 - p2)) / afterMiss.att)
  const z = se > 0 ? (p1 - p2 - (c1 - c2)) / se : 0
  return { afterMake, afterMiss, chanceAfterMake: c1 * 100, chanceAfterMiss: c2 * 100, gap: (p1 - p2) * 100, chanceGap: (c1 - c2) * 100, verdict: verdictOf(z) }
}

// "1 time in 3", "about half the time", for a chance between 0 and 1.
export function oneIn(p: number): string {
  if (p >= 0.95) return "almost every time"
  if (p >= 0.4 && p <= 0.6) return "about half the time"
  if (p > 0.6) return `${Math.round(p * 100)}% of the time`
  if (p < 0.005) return "less than 1 time in 200"
  return `about 1 time in ${Math.round(1 / p)}`
}
