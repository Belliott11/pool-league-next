import { describe, expect, it } from "vitest"
import custom from "@/data/custom-headlines.json"
import { customNight, customStories } from "@/lib/published"
import type { Game, PooleanState } from "@/lib/types"

const filmed = (n: number): Game[] => Array.from({ length: n }, (_, i) => ({ id: `g${i}`, date: "d", teamA: ["a"], teamB: ["b"], winner: "A", stats: [], scoringEvents: [{ id: `e${i}`, scorerId: "a", points: 2 }], turnoverEvents: [], stealEvents: [], foulEvents: [] }))

describe("custom headlines", () => {
  it("show the going-in and season lists until newer games are filmed", () => {
    const now: PooleanState = { players: [], games: filmed(custom.filmedGames) }
    const later: PooleanState = { players: [], games: filmed(custom.filmedGames + 1) }
    expect(customStories(now, "season")).toEqual(custom.season)
    expect(customStories(later, "season")).toBeNull()
  })
  it("keep a night's lines for good, with no em dashes anywhere", () => {
    expect(customNight("2026-08-16")?.full.length).toBeGreaterThan(3)
    expect(customNight("2001-01-01")).toBeNull()
    expect(JSON.stringify(custom)).not.toMatch(/—/)
  })
})
