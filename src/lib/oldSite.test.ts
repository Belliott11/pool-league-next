import { describe, expect, it } from "vitest"
import { oldPairs, oldRanksBetween, oldRecord } from "@/lib/oldSite"

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

describe("scoring a season with old site nights", () => {
  const state = { players: ["phillip", "ben", "x"].map((id) => ({ id, name: id })), games: [] }
  it("orders by the old power rankings that fall inside the season, and ignores seasons they do not cover", async () => {
    const { actualOrder } = await import("@/lib/predictions")
    expect(oldRanksBetween("2026-06-01", "2026-06-15").get("phillip")).toBe(100)
    expect(actualOrder(state, "2026-06-01", "2026-06-15")[0]).toBe("phillip")
    expect(actualOrder(state, "2027-06-01")).toEqual([])
  })
})

describe("old site players", () => {
  it("lists only people who appear in results, not stray name aliases", async () => {
    const { realPlayerIds } = await import("@/lib/real")
    const ids = realPlayerIds()
    expect(ids).toContain("ben")
    expect(ids).not.toContain("michael")
  })
})
