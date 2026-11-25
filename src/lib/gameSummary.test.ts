import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { gameSummary, swingOf } = await import("@/lib/gameSummary")

const players = [{ id: "a", name: "Ann" }, { id: "b", name: "Bo" }]
// A live-scored game to 6, win by 2: A leads 4-0, B ties it at 4, then A wins 6-4.
const g = {
  id: "g1",
  date: "2026-08-01",
  teamA: ["a"],
  teamB: ["b"],
  liveTarget: 6,
  winner: "A",
  stats: [],
  scoringEvents: [],
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
  liveScores: [
    { pid: "a", points: 2 },
    { pid: "a", points: 2 },
    { pid: "b", points: 2 },
    { pid: "b", points: 2 },
    { pid: "a", points: 2 },
  ],
} as unknown as Game
const state = { games: [g], players } as unknown as PooleanState

describe("game summary", () => {
  it("finds the winners' basket that moved the odds most, leaving out the one that ended it", () => {
    expect(swingOf(g, "A")!.scorerId).toBe("a")
    const s = swingOf(g)!
    // The basket that ends it (6-4) is left out; Bo's tying basket at 4-2 moves the odds most.
    expect(s.before).toEqual([4, 2])
    expect(s.scorerId).toBe("b")
    expect(s.gain).toBeGreaterThan(10)
  })
  it("writes the lines for the group chat", () => {
    const s = gameSummary(state, g)
    expect(s.winner).toBe("A")
    expect(s.text.split("\n")[0]).toBe("Final: Ann 6, Bo 4.")
    expect(s.text).toContain("The swing: Ann's 2")
    expect(s.text).toContain("#/games/game/g1")
    expect(s.top).toBeNull() // live-scored only: no Points added
  })
})
