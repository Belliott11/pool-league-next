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

  it("gives each basket its time in the recording when the recording's start is known", () => {
    const rec = Date.UTC(2026, 9, 7, 23, 0, 0)
    const timed: Game = { ...live, liveScores: [{ pid: "x", points: 2, at: rec + 61_500 }, { pid: "z", points: 3, at: rec + 1_000 }, { pid: "x", points: 1 }] }
    const g = importLiveBaskets(timed, rec)
    expect(g.scoringEvents.map((e) => e.videoTime)).toEqual([60, null, null]) // 1.5 s before the tap; none before the recording or without a time
    expect(importLiveBaskets(timed).scoringEvents.every((e) => e.videoTime === null)).toBe(true)
  })

  it("does not offer it while the game is still live", () => {
    expect(pendingBaskets({ ...live, liveInProgress: true })).toBe(0)
  })
})
