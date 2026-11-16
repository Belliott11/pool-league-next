import { targetOf } from "@/lib/insight"
import type { PooleanState } from "@/lib/types"

// Shooting when the game is on the line: before the shot, the teams are within CLOSE points and the leader is within LATE points
// of the score the game is played to. Only filmed games with a logged target count, since "late" needs one.
export const CLOSE = 2
export const LATE = 4

export interface ClutchRow {
  id: string
  clutch: { made: number; att: number; pts: number }
  rest: { made: number; att: number; pts: number }
}

export function clutchSplits(state: PooleanState): ClutchRow[] {
  const rows = new Map<string, ClutchRow>()
  const z = () => ({ made: 0, att: 0, pts: 0 })
  for (const g of state.games) {
    const target = targetOf(g)
    if (g.liveInProgress || !target || g.scoringEvents.length === 0) continue
    let a = 0
    let b = 0
    for (const e of g.scoringEvents) {
      const made = e.made !== false
      const onA = g.teamA.includes(e.scorerId)
      if (e.points !== 1) {
        const row = rows.get(e.scorerId) ?? rows.set(e.scorerId, { id: e.scorerId, clutch: z(), rest: z() }).get(e.scorerId)!
        const s = Math.abs(a - b) <= CLOSE && Math.max(a, b) >= target - LATE ? row.clutch : row.rest
        s.att++
        if (made) {
          s.made++
          s.pts += e.points
        }
      }
      if (made) onA ? (a += e.points) : (b += e.points)
    }
  }
  return [...rows.values()].filter((r) => r.clutch.att > 0).sort((x, y) => y.clutch.att - x.clutch.att)
}
