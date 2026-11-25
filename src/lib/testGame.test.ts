import { describe, expect, it, vi } from "vitest"
import type { PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { startLive, markTest } = await import("@/lib/live")
const { liveOpenForVotes } = await import("@/lib/pickem")

const base = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [] } as unknown as PooleanState

describe("test games", () => {
  it("marks a game started as a test, and keeps Pick'em closed for it", () => {
    const s = startLive(base, "t1", "2026-08-01", ["a"], ["b"], 16, undefined, true)
    expect(s.games[0].test).toBe(true)
    expect(liveOpenForVotes(s.games[0])).toBe(false)
    const real = startLive(base, "r1", "2026-08-01", ["a"], ["b"], 16)
    expect(real.games[0].test).toBeUndefined()
    expect(liveOpenForVotes(real.games[0])).toBe(true)
    expect(markTest(real, "r1").games[0].test).toBe(true)
  })
})
