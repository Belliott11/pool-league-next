import { predictRealMatchup } from "@/lib/matchup"
import { scoreOf } from "@/lib/nightRecap"
import type { Game, PooleanState } from "@/lib/types"

// The model's call is saved on the game when it is set up, before anything is played, and scored once the game has a
// result. Nothing is filled in afterward, so the record is only what the model actually said in advance.
export type Side = "A" | "B"

export function pregamePrediction(teamA: string[], teamB: string[]): Game["prediction"] {
  const p = predictRealMatchup(teamA, teamB)
  return p ? { pA: Math.round(p.pA * 1000) / 1000, at: new Date().toISOString() } : undefined
}

export const favoriteOf = (g: Game): Side | null => (!g.prediction || g.prediction.pA === 0.5 ? null : g.prediction.pA > 0.5 ? "A" : "B")
export const confidenceOf = (g: Game): number => (g.prediction ? Math.max(g.prediction.pA, 1 - g.prediction.pA) : 0)

// Who won, once there is a result. A game still being played or tied has none.
export function winnerOf(g: Game): Side | null {
  if (g.liveInProgress) return null
  const [a, b] = scoreOf(g)
  return a === b ? null : a > b ? "A" : "B"
}

export interface Call {
  game: Game
  favorite: Side
  winner: Side
  correct: boolean
  confidence: number
}

const BUCKETS = [
  { label: "50 to 60%", min: 0.5, max: 0.6 },
  { label: "60 to 70%", min: 0.6, max: 0.7 },
  { label: "70% or more", min: 0.7, max: 1.01 },
]

export function scorecard(state: PooleanState) {
  const calls: Call[] = state.games
    .map((game, i) => ({ game, i }))
    .sort((x, y) => (x.game.date || "").localeCompare(y.game.date || "") || x.i - y.i)
    .flatMap(({ game }) => {
      const favorite = favoriteOf(game)
      const winner = winnerOf(game)
      return favorite && winner ? [{ game, favorite, winner, correct: favorite === winner, confidence: confidenceOf(game) }] : []
    })
  const correct = calls.filter((c) => c.correct).length
  const waiting = state.games.filter((g) => favoriteOf(g) && !winnerOf(g)).length
  const buckets = BUCKETS.map((b) => {
    const inB = calls.filter((c) => c.confidence >= b.min && c.confidence < b.max)
    return { label: b.label, called: inB.length, correct: inB.filter((c) => c.correct).length }
  }).filter((b) => b.called > 0)
  return { calls, called: calls.length, correct, pct: calls.length ? Math.round((correct / calls.length) * 100) : null, waiting, buckets }
}

// One line for a game: what the model said beforehand and what happened. Null when nothing was saved for it.
export function predictionNote(g: Game | undefined): string | null {
  if (!g) return null
  const fav = favoriteOf(g)
  if (!fav || !g.prediction) return null
  const pct = Math.round(confidenceOf(g) * 100)
  const winner = winnerOf(g)
  const result = winner ? (winner === fav ? "right" : "wrong") : "no result yet"
  return `Model picked Team ${fav} (${pct}%), ${result}`
}
