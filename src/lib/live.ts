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

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

// Team A's chance to win given the score. Starts from the pre-game read (the real-matchup model, or
// even odds when there are not enough real games to train it) and leans on the current margin, as a
// fraction of the target so 2 points to 21 means little and 2 points to 5 means a lot. The score's
// weight grows as a team closes on the target, because a late lead decides far more than an early one.
// Same formula as the classic site's live game.
export function winProbabilityFrom(a: number, b: number, target: number, pregameA: number | null): number {
  if (a >= target && a > b) return 0.99
  if (b >= target && b > a) return 0.01
  const start = Math.min(0.999, Math.max(0.001, pregameA ?? 0.5))
  const progress = Math.min(1, Math.max(a, b) / target)
  const marginFrac = (a - b) / target
  const k = 5 * (0.4 + 0.6 * progress)
  const logit0 = Math.log(start / (1 - start))
  return Math.min(0.99, Math.max(0.01, sigmoid(logit0 + k * marginFrac)))
}

function pregameOf(game: Game): number | null {
  return predictRealMatchup(game.teamA, game.teamB)?.pA ?? null
}

export function liveWinProbability(game: Game): { pA: number; pregameA: number | null } {
  const pregameA = pregameOf(game)
  const [a, b] = liveTotals(game)
  return { pA: winProbabilityFrom(a, b, liveTargetOf(game), pregameA), pregameA }
}

// The win probability after each score, starting from the pre-game read, for the momentum line.
export function liveProbHistory(game: Game): number[] {
  const pregameA = pregameOf(game)
  const target = liveTargetOf(game)
  const scores = game.liveScores ?? []
  const out = [winProbabilityFrom(0, 0, target, pregameA)]
  let a = 0
  let b = 0
  for (const s of scores) {
    if (game.teamA.includes(s.pid)) a += s.points
    else if (game.teamB.includes(s.pid)) b += s.points
    out.push(winProbabilityFrom(a, b, target, pregameA))
  }
  return out
}
