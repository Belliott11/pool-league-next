import { describe, expect, it } from "vitest"
import { oldPairs, oldRecord } from "@/lib/oldSite"

describe("old site records", () => {
  it("reads a player's whole record and their most played partner and opponent", () => {
    expect(oldRecord("ben")).toEqual({ w: 33, l: 22 })
    expect(oldRecord("nobody")).toBeNull()
    const { mate, rival } = oldPairs("ben")
    expect(mate && mate.w + mate.l >= 5).toBe(true)
    expect(rival?.id).toBe("zach") // 33 games, the most against anyone
    expect(oldPairs("nobody")).toEqual({ mate: null, rival: null })
  })
})
