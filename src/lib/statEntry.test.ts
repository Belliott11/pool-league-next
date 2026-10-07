import { beforeAll, describe, expect, it, vi } from "vitest"
import { teamScore } from "@/lib/stats"
import type { Game } from "@/lib/types"

const live: Game = {
  id: "g",
  date: "2026-10-07",
  teamA: ["x"],
  teamB: ["z"],
  stats: [],
  scoringEvents: [],
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
  liveScores: [{ pid: "x", points: 2 }, { pid: "z", points: 3 }, { pid: "x", points: 1 }],
}

// The stat entry helpers load the classic code, which reads browser storage when it starts.
let importLiveBaskets: typeof import("@/lib/statEntry").importLiveBaskets
let pendingBaskets: typeof import("@/lib/statEntry").pendingBaskets
beforeAll(async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  ;({ importLiveBaskets, pendingBaskets } = await import("@/lib/statEntry"))
})

describe("importing live baskets", () => {
  it("turns each live basket into a made shot and keeps the score the same", () => {
    expect(pendingBaskets(live)).toBe(3)
    const g = importLiveBaskets(live)
    expect(g.scoringEvents.map((e) => [e.scorerId, e.points, e.made])).toEqual([["x", 2, true], ["z", 3, true], ["x", 1, true]])
    expect(teamScore(g, g.teamA)).toBe(3)
    expect(teamScore(g, g.teamB)).toBe(3)
    // Nothing is left to import twice.
    expect(pendingBaskets(g)).toBe(0)
    expect(importLiveBaskets(g)).toBe(g)
  })

  it("does not offer it while the game is still live", () => {
    expect(pendingBaskets({ ...live, liveInProgress: true })).toBe(0)
  })
})
