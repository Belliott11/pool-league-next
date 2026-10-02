import { predictRealMatchup } from "@/lib/matchup"
import { liveScoreOf } from "@/lib/stats"
import { newGame } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"

export const DEFAULT_TARGET = 21

export function findLiveGame(state: PooleanState): Game | undefined {
  return state.games.find((g) => g.liveInProgress)
}

export function liveTargetOf(game: Game): number {
  const t = Number(game.liveTarget)
  return t > 0 ? t : DEFAULT_TARGET
}

export function liveTotals(game: Game): [number, number] {
  return [liveScoreOf(game, game.teamA), liveScoreOf(game, game.teamB)]
}

export function startLive(state: PooleanState, id: string, date: string, teamA: string[], teamB: string[], target: number): PooleanState {
  const g = newGame({ id, date, teamA, teamB, liveInProgress: true, liveScores: [], liveTarget: target })
  return { ...state, games: [...state.games, g] }
}

function patch(state: PooleanState, id: string, fn: (g: Game) => Game): PooleanState {
  return { ...state, games: state.games.map((g) => (g.id === id ? fn(g) : g)) }
}

export function addLiveScore(state: PooleanState, id: string, pid: string, points: number): PooleanState {
  return patch(state, id, (g) => ({ ...g, liveScores: [...(g.liveScores ?? []), { pid, points }] }))
}

export function undoLiveScore(state: PooleanState, id: string): PooleanState {
  return patch(state, id, (g) => ({ ...g, liveScores: (g.liveScores ?? []).slice(0, -1) }))
}

export function finishLive(state: PooleanState, id: string): PooleanState {
  return patch(state, id, (g) => {
    const [a, b] = liveTotals(g)
    const rest = { ...g }
    delete rest.liveInProgress
    return { ...rest, winner: a > b ? "A" : b > a ? "B" : null }
  })
}

export function discardLive(state: PooleanState, id: string): PooleanState {
  return { ...state, games: state.games.filter((g) => g.id !== id) }
}

// Exact race to the target. Each score goes to team A with chance q and is worth 1, 2 or 3 points in the
// league's usual mix (measured on the logged games). V[a][b] is A's chance to win from the score a to b.
// This beats the old curve-fit because it knows a 3-point lead is worth less early than late.
const POINT_MIX: [number, number][] = [[1, 0.009], [2, 0.81], [3, 0.181]]
const tables = new Map<string, number[][]>()

function raceTable(target: number, q: number): number[][] {
  const key = target + "|" + q.toFixed(4)
  const hit = tables.get(key)
  if (hit) return hit
  const cap = target + 3
  const V = Array.from({ length: cap + 1 }, () => new Array<number>(cap + 1).fill(0))
  for (let a = cap; a >= 0; a--)
    for (let b = cap; b >= 0; b--) {
      if (a >= target && a > b) V[a][b] = 1
      else if (b >= target && b > a) V[a][b] = 0
      else if (a >= target && b >= target) V[a][b] = 0.5
      else {
        let v = 0
        for (const [k, p] of POINT_MIX) v += p * (q * V[Math.min(a + k, cap)][b] + (1 - q) * V[a][Math.min(b + k, cap)])
        V[a][b] = v
      }
    }
  if (tables.size > 60) tables.clear()
  tables.set(key, V)
  return V
}

// The per-score share q that makes the pre-game chance equal `pre`.
function shareFor(target: number, pre: number): number {
  let lo = 0.05
  let hi = 0.95
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (raceTable(target, mid)[0][0] < pre) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// The pre-game read is worth this many scores of evidence; the game's own scoring then moves q.
// Replaying the 9 logged games, 20 gave the lowest log loss (10 and 40 were close).
const PRIOR_SCORES = 20

export function winProbabilityFrom(a: number, b: number, target: number, pregameA: number | null, nA = 0, nB = 0): number {
  if (a >= target && a > b) return 0.99
  if (b >= target && b > a) return 0.01
  const pre = Math.min(0.97, Math.max(0.03, pregameA ?? 0.5))
  const q0 = shareFor(target, pre)
  const q = Math.min(0.97, Math.max(0.03, (PRIOR_SCORES * q0 + nA) / (PRIOR_SCORES + nA + nB)))
  const cap = target + 3
  return Math.min(0.99, Math.max(0.01, raceTable(target, q)[Math.min(a, cap)][Math.min(b, cap)]))
}

function liveCounts(game: Game) {
  let nA = 0
  let nB = 0
  for (const s of game.liveScores ?? []) {
    if (game.teamA.includes(s.pid)) nA++
    else if (game.teamB.includes(s.pid)) nB++
  }
  return { nA, nB }
}

function pregameOf(game: Game): number | null {
  return predictRealMatchup(game.teamA, game.teamB)?.pA ?? null
}

export function liveWinProbability(game: Game): { pA: number; pregameA: number | null } {
  const pregameA = pregameOf(game)
  const [a, b] = liveTotals(game)
  const counts = liveCounts(game)
  return { pA: winProbabilityFrom(a, b, liveTargetOf(game), pregameA, counts.nA, counts.nB), pregameA }
}

// The win probability after each score, starting from the pre-game read, for the momentum line.
export function liveProbHistory(game: Game): number[] {
  const pregameA = pregameOf(game)
  const target = liveTargetOf(game)
  const scores = game.liveScores ?? []
  const out = [winProbabilityFrom(0, 0, target, pregameA)]
  let a = 0
  let b = 0
  let nA = 0
  let nB = 0
  for (const s of scores) {
    if (game.teamA.includes(s.pid)) {
      a += s.points
      nA++
    } else if (game.teamB.includes(s.pid)) {
      b += s.points
      nB++
    }
    out.push(winProbabilityFrom(a, b, target, pregameA, nA, nB))
  }
  return out
}
