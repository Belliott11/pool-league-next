import { shotEnd } from "@/lib/epa"
import { liveTargetOf, winProbabilityFrom } from "@/lib/live"
import { winProbabilityWithBall, type BallRates, type Trips } from "@/lib/liveBall"
import { backtestPick } from "@/lib/matchup"
import { basketsOf } from "@/lib/momentum"
import { gameOver } from "@/lib/race"
import { isLiveScoreOnly } from "@/lib/stats"
import type { Game } from "@/lib/types"

// A game's win chance basket by basket: the pre-game read from the nights before (or the call saved when the game was set up), then the
// race to the target as the baskets came. Every basket says how far it moved them.
// With the league's trip rates passed in and every play of the game in order (every shot, live-ball turnover and free throw has a video
// time), the odds also know who has the ball (liveBall.ts): misses, turnovers and offensive rebounds between baskets move them, so a
// basket's "before" is the chance just before it, after the plays since the last basket. Checked 2026-11-27 against who won, at every
// play of the 6 games it could be run on: log loss 0.438 against 0.451 for the score-only odds (0.442 against 0.450 at the baskets
// alone), better in 5 of the 6 (src/lib/liveBall.test.ts reruns it). Otherwise (live-scored games, plays without video times) it is the
// live screen's score-only odds (live.ts), which the live screen keeps: a live game logs baskets only.

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
  ball: boolean // the odds knew who had the ball
}

// Every play of a filmed game in order, or null when any of them has no video time.
type Play = { t: number; side: "A" | "B"; kind: "made" | "missOut" | "missKept" | "missLost" | "turnover" | "ft"; points: number; scorerId: string; assistId: string | null }
function playsInOrder(game: Game): Play[] | null {
  if (isLiveScoreOnly(game) || !game.scoringEvents.length) return null
  const sideOf = (id: string): "A" | "B" | null => (game.teamA.includes(id) ? "A" : game.teamB.includes(id) ? "B" : null)
  const outs = new Set(game.turnoverEvents.map((t) => t.missEventId).filter(Boolean) as string[])
  const onShot = new Set(game.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
  const steals = new Map(game.stealEvents.map((x) => [x.id, x]))
  const out: Play[] = []
  for (const e of game.scoringEvents) {
    const side = sideOf(e.scorerId)
    if (!side) continue
    if (e.points === 1) {
      if (e.made === false) continue
      if (e.videoTime == null) return null
      out.push({ t: e.videoTime, side, kind: "ft", points: 1, scorerId: e.scorerId, assistId: null })
      continue
    }
    if (e.videoTime == null) return null
    const end = shotEnd(game, e, outs)
    const kind = end === "made" ? "made" : end === "out" ? "missOut" : end === "kept" ? "missKept" : "missLost"
    out.push({ t: e.videoTime, side, kind, points: e.points, scorerId: e.scorerId, assistId: e.made !== false && e.assistId && e.assistId !== e.scorerId ? e.assistId : null })
  }
  for (const t of game.turnoverEvents) {
    if (t.missEventId || onShot.has(t.id)) continue
    const side = sideOf(t.playerId)
    if (!side) continue
    const at = t.videoTime ?? (t.stealEventId ? steals.get(t.stealEventId)?.videoTime : undefined)
    if (at == null) return null
    out.push({ t: at, side, kind: "turnover", points: 0, scorerId: t.playerId, assistId: null })
  }
  return out.sort((x, y) => x.t - y.t)
}

function withBall(target: number, pre: number | null, rates: BallRates, plays: Play[]): OddsTimeline {
  let a = 0
  let b = 0
  let ball: "A" | "B" | null = null
  const trips: Trips = { tripsA: 0, scoredA: 0, tripsB: 0, scoredB: 0 }
  const chance = () => winProbabilityWithBall(a, b, target, pre, ball, rates, trips)
  const start = chance()
  let p = start
  const steps: OddsStep[] = []
  const other = (s: "A" | "B") => (s === "A" ? "B" : "A")
  const trip = (s: "A" | "B", scored: boolean) => {
    if (s === "A") (trips.tripsA++, scored && trips.scoredA++)
    else (trips.tripsB++, scored && trips.scoredB++)
  }
  for (const k of plays) {
    if (k.kind === "ft" || k.kind === "made") {
      if (k.side === "A") a += k.points
      else b += k.points
      if (k.kind === "made") {
        trip(k.side, true)
        ball = other(k.side)
      }
      const ends = gameOver(a, b, target)
      const after = ends ? (a > b ? 1 : 0) : chance()
      steps.push({ index: steps.length, side: k.side, scorerId: k.scorerId, assistId: k.assistId, points: k.points, a, b, before: p, after, videoTime: k.t, ends })
      p = after
      if (ends) break
      continue
    }
    if (k.kind === "missKept") ball = k.side
    else {
      trip(k.side, false)
      ball = other(k.side)
    }
    p = chance()
  }
  return { target, start, steps, ball: true }
}

export function oddsTimeline(game: Game, rates?: BallRates | null): OddsTimeline {
  const target = liveTargetOf(game)
  const pre = backtestPick(game) ?? game.prediction?.pA ?? null
  const baskets =
    !isLiveScoreOnly(game) && game.scoringEvents.length
      ? basketsOf(game)
      : [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])]
          .map((s) => ({ side: game.teamA.includes(s.pid) ? ("A" as const) : game.teamB.includes(s.pid) ? ("B" as const) : null, points: s.points, scorerId: s.pid, assistId: null, videoTime: null }))
          .filter((k): k is { side: "A" | "B"; points: number; scorerId: string; assistId: null; videoTime: null } => k.side !== null)
  const plays = rates ? playsInOrder(game) : null
  if (rates && plays) return withBall(target, pre, rates, plays)
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
  return { target, start, steps, ball: false }
}

// The baskets that moved the odds most (for the scoring side), biggest first, leaving out the one that ended the game.
export function bigSwings(t: OddsTimeline, n = 3): Set<number> {
  const gain = (s: OddsStep) => (s.side === "A" ? s.after - s.before : s.before - s.after)
  return new Set([...t.steps].filter((s) => !s.ends).sort((x, y) => gain(y) - gain(x)).slice(0, n).map((s) => s.index))
}
