import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { linesFor, propStandings, PRIOR_GAMES } = await import("@/lib/props")

const game = (id: string, date: string, pts: Record<string, number>, extra: Partial<Game> = {}): Game =>
  ({ id, date, teamA: ["a"], teamB: ["b"], winner: "A", liveTarget: 10, stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], liveScores: Object.entries(pts).map(([pid, points]) => ({ pid, points })), ...extra }) as unknown as Game

describe("prop picks", () => {
  const past = [game("g1", "2027-06-01", { a: 8, b: 2 }), game("g2", "2027-06-02", { a: 6, b: 4 })]
  const live = game("live", "2027-06-03", {}, { winner: null, liveInProgress: true })
  const state = { players: [], games: [...past, live] } as unknown as PooleanState
  it("leans each line on the league's rate and rounds down to a half", () => {
    const lines = linesFor(state, live)
    // a: 14 points over 20 points of target; the league 20 over 40. Leaning by 3 games of 10: (14 + 0.5 * 30) / 50 = 0.58 a point, so 5.8 to 10.
    expect(PRIOR_GAMES).toBe(3)
    expect(lines.get("a")).toBe(5.5)
    expect(lines.get("b")).toBe(4.5) // (6 + 15) / 50 = 0.42, 4.2
  })
  it("scores picks against the line from the data, whatever was sent, and never a pick on yourself", () => {
    const after = { ...state, games: [...past, game("live", "2027-06-03", { a: 7, b: 3 })] } as unknown as PooleanState
    const rows = propStandings(after, [
      { gameId: "live", pid: "a", voter: "z", pick: "over" }, // 7 over 5.5: right
      { gameId: "live", pid: "b", voter: "z", pick: "over" }, // 3 under 4.5: wrong
      { gameId: "live", pid: "a", voter: "a", pick: "over" }, // their own line: left out
    ])
    expect(rows).toEqual([{ voter: "z", right: 1, total: 2 }])
  })
})
