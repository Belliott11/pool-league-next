import { describe, expect, it } from "vitest"
import { keepCloudMarks } from "./keepCloudMarks"
import type { PooleanState } from "./types"

const state = (games: unknown[]) => ({ games }) as unknown as PooleanState

describe("keepCloudMarks", () => {
  it("adds back clip reviews and replay flags only the cloud has, and keeps this copy's own", () => {
    const local = state([{ id: "g1", clipReviews: [{ key: "a", verdict: "skip" }], reviews: [{ id: "r1", at: 1 }] }, { id: "g2" }])
    const cloud = state([
      { id: "g1", clipReviews: [{ key: "a", verdict: "keep" }, { key: "b", verdict: "keep" }], reviews: [{ id: "r1", at: 1 }, { id: "r2", at: 2 }] },
      { id: "g2", clipReviews: [{ key: "c", verdict: "keep" }] },
      { id: "gone", clipReviews: [{ key: "d", verdict: "keep" }] },
    ])
    const out = keepCloudMarks(local, cloud)
    expect(out.games[0].clipReviews).toEqual([{ key: "a", verdict: "skip" }, { key: "b", verdict: "keep" }])
    expect(out.games[0].reviews?.map((r) => r.id)).toEqual(["r1", "r2"])
    expect(out.games[1].clipReviews?.map((r) => r.key)).toEqual(["c"])
    expect(out.games).toHaveLength(2)
  })

  it("returns the same copy when nothing is missing", () => {
    const local = state([{ id: "g1", clipReviews: [{ key: "a", verdict: "keep" }] }])
    expect(keepCloudMarks(local, local)).toBe(local)
    expect(keepCloudMarks(local, null)).toBe(local)
  })
})
