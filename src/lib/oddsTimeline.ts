import { liveTargetOf, winProbabilityFrom } from "@/lib/live"
import { backtestPick } from "@/lib/matchup"
import { basketsOf } from "@/lib/momentum"
import { gameOver } from "@/lib/race"
import { isLiveScoreOnly } from "@/lib/stats"
import type { Game } from "@/lib/types"

// A game's win chance basket by basket, the same live odds as the live screen (live.ts): the pre-game read from the nights before (or
// the call saved when the game was set up), then the race to the target as the baskets came. Every basket says how far it moved them.

export interface OddsStep {
  index: number
  side: "A" | "B"
  scorerId: string
  assistId: string | null
  points: number
  a: number // score after it
  b: number
  before: number // Team A's chance before the basket
  after: number // and after it
  videoTime: number | null
  ends: boolean
}

export interface OddsTimeline {
  target: number
  start: number // Team A's chance at the tip
  steps: OddsStep[]
}

export function oddsTimeline(game: Game): OddsTimeline {
  const target = liveTargetOf(game)
  const pre = backtestPick(game) ?? game.prediction?.pA ?? null
  const baskets =
    !isLiveScoreOnly(game) && game.scoringEvents.length
      ? basketsOf(game)
      : [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])]
          .map((s) => ({ side: game.teamA.includes(s.pid) ? ("A" as const) : game.teamB.includes(s.pid) ? ("B" as const) : null, points: s.points, scorerId: s.pid, assistId: null, videoTime: null }))
          .filter((k): k is { side: "A" | "B"; points: number; scorerId: string; assistId: null; videoTime: null } => k.side !== null)
  const start = winProbabilityFrom(0, 0, target, pre)
  let a = 0
  let b = 0
  let nA = 0
  let nB = 0
  let p = start
  const steps: OddsStep[] = []
  baskets.forEach((k, index) => {
    if (k.side === "A") (a += k.points), nA++
    else (b += k.points), nB++
    const ends = gameOver(a, b, target)
    const after = ends ? (a > b ? 1 : 0) : winProbabilityFrom(a, b, target, pre, nA, nB)
    steps.push({ index, side: k.side, scorerId: k.scorerId, assistId: k.assistId ?? null, points: k.points, a, b, before: p, after, videoTime: k.videoTime ?? null, ends })
    p = after
  })
  return { target, start, steps }
}

// The baskets that moved the odds most (for the scoring side), biggest first, leaving out the one that ended the game.
export function bigSwings(t: OddsTimeline, n = 3): Set<number> {
  const gain = (s: OddsStep) => (s.side === "A" ? s.after - s.before : s.before - s.after)
  return new Set([...t.steps].filter((s) => !s.ends).sort((x, y) => gain(y) - gain(x)).slice(0, n).map((s) => s.index))
}
