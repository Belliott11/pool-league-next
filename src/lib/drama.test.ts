import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const made = (id: string, scorerId: string) => ({ id, scorerId, points: 2 as const, made: true })
const game = (id: string, order: string[]): Game =>
  ({ id, date: "2026-07-01", liveTarget: 7, teamA: ["a"], teamB: ["b"], stats: [], turnoverEvents: [], stealEvents: [], foulEvents: [], scoringEvents: order.map((p, i) => made(`${id}${i}`, p)) }) as unknown as Game

describe("game drama", () => {
  // B goes up 6-0, then A scores four in a row to win 8-6: a comeback with a late lead change.
  const comeback = game("c", ["b", "b", "b", "a", "a", "a", "a"])
  // A wins 8-0 without B scoring.
  const rout = game("r", ["a", "a", "a", "a"])
  const state = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [comeback, rout] } as unknown as PooleanState

  it("scores a back-and-forth comeback above a rout, and says why", async () => {
    const { dramaRanking, dramaWords } = await import("@/lib/drama")
    const r = dramaRanking(state)
    expect(r[0].gameId).toBe("c")
    expect(r[0].score).toBeGreaterThan(r[1].score)
    expect(r[0].winner).toBe("A")
    expect(r[0].comeback).toBeLessThan(0.3)
    expect(r[0].leadChanges).toBe(1)
    expect(dramaWords(r[0]).join(" ")).toMatch(/came back from/)
    expect(dramaWords(r[1])).toEqual([])
  })
})
