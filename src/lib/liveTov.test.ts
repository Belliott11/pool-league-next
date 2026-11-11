import { describe, expect, it } from "vitest"
import { PER } from "@/lib/per"
import { computeLeaderboard } from "@/lib/stats"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const shot = (id: string, scorerId: string, made: boolean, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId, points: 2, made, videoTime: 1, ...extra })
const line = (playerId: string, pts: number, tov: number) => ({ playerId, pts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov, pf: 0 })
// a has 3 turnovers: two live-ball and one that was a stolen shot (linked to a shot).
const g: Game = {
  id: "g", date: "2026-08-10", teamA: ["a"], teamB: ["b"],
  stats: [line("a", 4, 3), line("b", 6, 0)],
  scoringEvents: [shot("1", "a", true), shot("2", "a", true), shot("3", "b", true), shot("4", "b", true), shot("5", "b", true), shot("6", "a", false, { turnoverEventId: "t3" })],
  turnoverEvents: [{ id: "t1", playerId: "a", videoTime: 5 }, { id: "t2", playerId: "a", videoTime: 9 }, { id: "t3", playerId: "a", missEventId: "6", videoTime: 20 }],
  stealEvents: [], foulEvents: [],
}
const state: PooleanState = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [g] }

describe("live-ball turnover rate", () => {
  const a = computeLeaderboard(state).find((r) => r.player.id === "a")!
  it("counts only live-ball turnovers, per the app's per-game scale", () => {
    expect(a.tovSplit).toMatchObject({ liveBall: 2, shotBased: 1, total: 3 })
    expect(a.liveTovPer25).toBeCloseTo((2 / 10) * PER, 6)
  })
  it("shows the share of turnovers that were live-ball", () => {
    expect(a.liveTovShare).toBe(67)
  })
})
