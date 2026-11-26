import type { OddsStep } from "@/lib/oddsTimeline"

// The score on the game video at a moment, for the overlay (src/components/ScoreOverlay.tsx). A shot's video time is the release (or 1.5 s
// before a live tap), so a basket counts on screen LAG seconds after it. Outside the game's own stretch of the recording (a recording can
// hold several games) there is no score to show.
export const LAG = 1.5
const BEFORE = 45 // seconds before the first basket the scoreboard comes up at 0-0
const AFTER = 20 // and how long it stays after the last

export interface ScoreNow {
  a: number
  b: number
  odds: number // Team A's chance
  last: OddsStep | null
  fresh: boolean // a basket just went in (for a short flash)
}

export function scoreAt(steps: OddsStep[], start: number, t: number): ScoreNow | null {
  const timed = steps.filter((s) => s.videoTime !== null)
  if (!timed.length) return null
  const first = timed[0].videoTime!
  const lastT = timed[timed.length - 1].videoTime!
  if (t < first - BEFORE || t > lastT + LAG + AFTER) return null
  let last: OddsStep | null = null
  for (const s of steps) if (s.videoTime !== null && s.videoTime + LAG <= t) last = s
  return { a: last?.a ?? 0, b: last?.b ?? 0, odds: last ? last.after : start, last, fresh: !!last && t - (last.videoTime! + LAG) < 2.5 }
}
