import shares from "@/data/clip-shares.json"
import { bestClips } from "@/lib/clips"
import { clipIdOf, shareLink } from "@/lib/clipShare"
import { pointsAdded } from "@/lib/epa"
import { ballRates, type BallRates } from "@/lib/liveBall"
import { oddsTimeline } from "@/lib/oddsTimeline"
import { playerName } from "@/lib/players"
import { SITE } from "@/lib/site"
import { isLiveScoreOnly, liveScoreOf, teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// A finished game in three lines, for the group chat: the final score, the basket that swung it (the winners' biggest move in the
// live odds, leaving out the basket that ended the game) and who added the most points (Points added, filmed games only), with a link to the best play or the game.

export interface Swing {
  scorerId: string
  points: number
  side: "A" | "B"
  before: [number, number]
  gain: number // points of win chance it gave the scorer's team
}

export interface GameSummary {
  a: number
  b: number
  winner: "A" | "B" | null
  swing: Swing | null
  top: { id: string; value: number } | null
  link: string
  linkIsClip: boolean
  text: string
}

// The winners' basket that moved the odds most, not counting the one that ended it. Read off the same odds as the game page's Odds tab
// (oddsTimeline.ts), so the summary and the chart always agree; with `rates`, they know who had the ball.
export function swingOf(game: Game, winner?: "A" | "B" | null, rates?: BallRates | null): Swing | null {
  let best: Swing | null = null
  for (const k of oddsTimeline(game, rates).steps) {
    if (k.ends) break
    const gain = (k.side === "A" ? k.after - k.before : k.before - k.after) * 100
    const at: [number, number] = k.side === "A" ? [k.a - k.points, k.b] : [k.a, k.b - k.points]
    if ((!winner || k.side === winner) && (!best || gain > best.gain)) best = { scorerId: k.scorerId, points: k.points, side: k.side, before: at, gain }
  }
  return best
}

export function gameSummary(state: PooleanState, game: Game): GameSummary {
  const live = isLiveScoreOnly(game)
  const a = live ? liveScoreOf(game, game.teamA) : teamScore(game, game.teamA)
  const b = live ? liveScoreOf(game, game.teamB) : teamScore(game, game.teamB)
  const winner = game.winner === "A" || game.winner === "B" ? game.winner : a > b ? "A" : b > a ? "B" : null
  const swing = swingOf(game, winner, ballRates(state))
  const rows = game.scoringEvents.length ? pointsAdded(state, { only: game.id }).rows : []
  const best = [...rows].sort((x, y) => y.total - x.total)[0]
  const top = best && best.total > 0 ? { id: best.id, value: best.total } : null
  const table = shares as Record<string, unknown>
  const clip = bestClips(state, { gameIds: [game.id], limit: 4, perGame: 4 }).map((c) => clipIdOf(state, c)).find((id) => id && table[id]) ?? null
  const link = clip ? shareLink(clip) : `${SITE}#/games/game/${encodeURIComponent(game.id)}`
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  const lines = [
    winner
      ? `Final: ${names(winner === "A" ? game.teamA : game.teamB)} ${Math.max(a, b)}, ${names(winner === "A" ? game.teamB : game.teamA)} ${Math.min(a, b)}.`
      : `Final: ${names(game.teamA)} ${a}, ${names(game.teamB)} ${b}.`,
  ]
  if (swing) lines.push(`The swing: ${playerName(state, swing.scorerId)}'s ${swing.points} at ${swing.before[0]}-${swing.before[1]}, +${Math.round(swing.gain)} points of win chance.`)
  if (top) lines.push(`Most points added: ${playerName(state, top.id)}, ${top.value > 0 ? "+" : ""}${top.value.toFixed(1)}.`)
  lines.push(clip ? `Best play: ${link}` : link)
  return { a, b, winner, swing, top, link, linkIsClip: !!clip, text: lines.join("\n") }
}
