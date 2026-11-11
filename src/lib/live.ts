import { predictRealMatchup } from "@/lib/matchup"
import { pregamePrediction } from "@/lib/scorecard"
import { liveScoreOf } from "@/lib/stats"
import { newGame } from "@/lib/store"
import { gameOver, raceWin } from "@/lib/race"
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

export function startLive(state: PooleanState, id: string, date: string, teamA: string[], teamB: string[], target: number, teamsPickedBy?: Game["teamsPickedBy"]): PooleanState {
  const g = newGame({ id, date, teamA, teamB, liveInProgress: true, liveScores: [], liveTarget: target, teamsPickedBy, prediction: pregamePrediction(teamA, teamB) })
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
    // Friends' baskets become part of the game's score so the stats see one list.
    if (rest.scorekeeperScores?.length) rest.liveScores = [...(rest.liveScores ?? []), ...rest.scorekeeperScores]
    delete rest.scorekeeperScores
    return { ...rest, winner: a > b ? "A" : b > a ? "B" : null }
  })
}

// The editor's app does not replace its whole copy while a game is live; it only takes the friends' baskets
// from the shared copy, so the editor's own baskets are never overwritten.
export function adoptScorekeeperScores(local: PooleanState, remote: PooleanState): PooleanState {
  let changed = false
  const games = local.games.map((g) => {
    if (!g.liveInProgress) return g
    const r = remote.games.find((x) => x.id === g.id)
    const theirs = r?.scorekeeperScores ?? []
    const mine = g.scorekeeperScores ?? []
    if (!r || (theirs.length === mine.length && theirs.every((s, i) => s.pid === mine[i].pid && s.points === mine[i].points))) return g
    changed = true
    return { ...g, scorekeeperScores: theirs }
  })
  return changed ? { ...local, games } : local
}

export function discardLive(state: PooleanState, id: string): PooleanState {
  return { ...state, games: state.games.filter((g) => g.id !== id) }
}

// Exact race to the target. Each score goes to team A with chance q and is worth 1, 2 or 3 points in the
// league's usual mix (measured on the logged games). V[a][b] is A's chance to win from the score a to b.
// This beats the old curve-fit because it knows a 3-point lead is worth less early than late.
const POINT_MIX: [number, number][] = [[1, 0.009], [2, 0.81], [3, 0.181]]
// The per-score share q that makes the pre-game chance equal `pre`.
function shareFor(target: number, pre: number): number {
  let lo = 0.05
  let hi = 0.95
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (raceWin(0, 0, target, mid, POINT_MIX) < pre) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// The pre-game read is worth this many scores of evidence; the game's own scoring then moves q.
// Replaying the 9 logged games, 20 gave the lowest log loss (10 and 40 were close).
const PRIOR_SCORES = 20

export function winProbabilityFrom(a: number, b: number, target: number, pregameA: number | null, nA = 0, nB = 0): number {
  if (gameOver(a, b, target)) return a > b ? 0.99 : 0.01
  const pre = Math.min(0.97, Math.max(0.03, pregameA ?? 0.5))
  const q0 = shareFor(target, pre)
  const q = Math.min(0.97, Math.max(0.03, (PRIOR_SCORES * q0 + nA) / (PRIOR_SCORES + nA + nB)))
  return Math.min(0.99, Math.max(0.01, raceWin(a, b, target, q, POINT_MIX)))
}

function liveCounts(game: Game) {
  let nA = 0
  let nB = 0
  for (const s of [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])]) {
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
  const scores = [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])]
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
