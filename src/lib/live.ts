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
