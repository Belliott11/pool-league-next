import { describe, expect, it } from "vitest"
import { guardPlan } from "./guardPlan"
import type { DefenseTable } from "./playerDefense"
import type { PooleanState } from "./types"

const table: DefenseTable = {
  league: 1,
  defenders: [],
  pairs: [
    { defenderId: "d1", scorerId: "s1", shots: 10, allowed: 4, usual: 1, saved: 6, beaten: 0 },
    { defenderId: "d2", scorerId: "s1", shots: 10, allowed: 9, usual: 1, saved: 1, beaten: 0 },
    { defenderId: "d2", scorerId: "s2", shots: 10, allowed: 7, usual: 1, saved: 3, beaten: 0 },
    { defenderId: "d1", scorerId: "s2", shots: 10, allowed: 6, usual: 1, saved: 4, beaten: 0 },
  ],
}
const state = { games: [] } as unknown as PooleanState

describe("guardPlan", () => {
  it("picks the matchups that save the most together", () => {
    const p = guardPlan(state, { teamA: ["d1", "d2"], teamB: ["s1", "s2"] }, table)
    expect(p.forA.map((c) => `${c.defenderId}>${c.scorerId}`).sort()).toEqual(["d1>s1", "d2>s2"])
  })
  it("leaves the extra player out of the pairs", () => {
    const p = guardPlan(state, { teamA: ["d1", "d2", "d3"], teamB: ["s1", "s2"] }, table)
    expect(p.forA).toHaveLength(2)
  })
})
