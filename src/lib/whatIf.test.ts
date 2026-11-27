import { describe, expect, it, vi } from "vitest"
import type { Game } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })

describe("what if a play had gone the other way", () => {
  const shot = (id: string, scorerId: string, made: boolean, videoTime: number, extra = {}) => ({ id, scorerId, points: 2 as const, made, videoTime, ...extra })
  const game = {
    id: "g", date: "2026-07-01", liveTarget: 11, teamA: ["a"], teamB: ["b"], stats: [], stealEvents: [], foulEvents: [],
    turnoverEvents: [{ id: "t", playerId: "b", opponentId: "a", videoTime: 3 }],
    scoringEvents: [shot("e1", "a", true, 1), shot("e2", "b", false, 2, { rebounderId: "a" }), shot("e3", "a", true, 4), shot("e4", "b", true, 5)],
  } as unknown as Game

  it("knows every play with the ball: a make missing hurts the shooters, a miss going in helps them, a turnover undone helps the team that lost it", async () => {
    const { oddsTimeline, biggestWhatIfs } = await import("@/lib/oddsTimeline")
    const t = oddsTimeline(game, { p: 0.3, share3: 0.18 })
    expect(t.whatIfs.map((w) => w.kind)).toEqual(["made", "miss", "turnover", "made", "made"])
    const [make, miss, tov] = t.whatIfs
    expect(make.flipped).toBeLessThan(make.actual) // A's basket missing: A's chance lower
    expect(miss.flipped).toBeLessThan(miss.actual) // B's miss going in: A's chance lower
    expect(tov.flipped).toBeLessThan(tov.actual) // B keeping the ball: A's chance lower
    expect(biggestWhatIfs(t, 2)).toHaveLength(2)
  })

  it("without the ball, only baskets: a miss leaves the odds where they were", async () => {
    const { oddsTimeline } = await import("@/lib/oddsTimeline")
    const t = oddsTimeline(game)
    expect(t.whatIfs.every((w) => w.kind === "made")).toBe(true)
    expect(t.whatIfs[0].flipped).toBeCloseTo(t.start, 9)
  })
})
