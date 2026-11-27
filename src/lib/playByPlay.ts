import { shotSentence, turnoverSentence } from "@/lib/playWords"
import type { Game } from "@/lib/types"

// A broadcast-style line under the score on the game video (src/components/ScoreOverlay.tsx): every logged shot and turnover with a
// video time, told as a plain sentence (playWords.ts: "Zach hits a 3 off Ben's pass."). A shot's video time is the release, so a line
// comes up then and stays SHOW seconds; a turnover's line the same.
export const SHOW = 4

export interface PlayLine {
  t: number
  text: string
  good: boolean | null // a make, a miss, or neither (a turnover)
}

type Name = (pid: string) => string

export function playByPlay(game: Game, name: Name): PlayLine[] {
  const out: PlayLine[] = []
  const evs = game.scoringEvents ?? []
  const team = (pid: string) => (game.teamA.includes(pid) ? 0 : game.teamB.includes(pid) ? 1 : null)
  const outOfBounds = new Set((game.turnoverEvents ?? []).map((t) => t.missEventId).filter(Boolean))
  for (const e of evs) {
    if (e.videoTime == null) continue
    const made = e.made !== false
    const end = made ? "made" : outOfBounds.has(e.id) ? "out" : e.rebounderId && team(e.rebounderId) === team(e.scorerId) ? "kept" : "lost"
    const text = shotSentence(
      { player: e.scorerId, points: e.points, made, shotType: e.dunk ? "dunk" : (e.shotType ?? null), passer: e.assistId ?? null, defenders: (e.defenderIds ?? []).filter(Boolean), contest: e.contestLevel ?? null, blocker: e.blockerId ?? null, end, rebounder: e.rebounderId ?? null },
      name,
    )
    out.push({ t: e.videoTime, text, good: made })
  }
  const steals = new Map((game.stealEvents ?? []).map((s) => [s.id, s]))
  for (const t of game.turnoverEvents ?? []) {
    if (t.missEventId) continue // a miss ruled out of bounds: the shot's line covers it
    const s = t.stealEventId ? steals.get(t.stealEventId) : undefined
    const at = t.videoTime ?? s?.videoTime
    if (at == null) continue
    const thief = s?.playerId ?? t.opponentId
    out.push({ t: at, text: turnoverSentence(t.playerId, thief ?? null, name), good: null })
  }
  return out.sort((a, b) => a.t - b.t)
}

// The line showing at a moment of the video, if any.
export function lineAt(lines: PlayLine[], t: number): PlayLine | null {
  let cur: PlayLine | null = null
  for (const l of lines) if (l.t <= t && t < l.t + SHOW) cur = l
  return cur
}
