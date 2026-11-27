import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const shot = (id: string, scorerId: string, made: boolean, d: string) => ({ id, scorerId, points: 2 as const, made, shotType: "drive", contestLevel: "medium", defenderIds: [d] })
// a misses everything for 3 games, then makes everything for 3; b does the opposite.
const game = (i: number): Game => {
  const late = i >= 3
  const ev = []
  for (let k = 0; k < 6; k++) ev.push(shot(`a${i}${k}`, "a", late, "b"), shot(`b${i}${k}`, "b", !late, "a"))
  ev.push(shot(`w${i}`, late ? "a" : "b", true, late ? "b" : "a"))
  return { id: `g${i}`, date: `2026-07-0${i + 1}`, liveTarget: 50, teamA: ["a"], teamB: ["b"], stats: [], turnoverEvents: [], stealEvents: [], foulEvents: [], scoringEvents: ev } as unknown as Game
}

describe("who's improving", () => {
  it("ranks the player whose recent games got better first, and names the part", async () => {
    const { setFilters } = await import("@/lib/filters")
    setFilters({ imbalanced: true })
    const { improving } = await import("@/lib/improving")
    const state = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [0, 1, 2, 3, 4, 5].map(game) } as unknown as PooleanState
    const r = improving(state)
    expect(r.map((x) => x.id)).toEqual(["a", "b"])
    expect(r[0].change).toBeGreaterThan(0)
    expect(r[1].change).toBeLessThan(0)
    expect(r[0].top).toBe("shots")
  })
})
