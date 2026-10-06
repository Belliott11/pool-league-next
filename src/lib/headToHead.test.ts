import { describe, expect, it } from "vitest"
import { headToHead, mostMetPair } from "@/lib/headToHead"
import type { Game, PooleanState } from "@/lib/types"

const game = (id: string, date: string, a: string[], b: string[], scores: [string, number][]): Game => ({
  id,
  date,
  teamA: a,
  teamB: b,
  stats: [],
  scoringEvents: [],
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
  liveScores: scores.map(([pid, points]) => ({ pid, points })),
})

const state: PooleanState = {
  players: [],
  games: [
    game("1", "2026-09-01", ["x"], ["z"], [["x", 5], ["z", 2]]),
    game("2", "2026-09-08", ["x"], ["z"], [["z", 6], ["x", 3]]),
    game("3", "2026-09-15", ["z", "x"], ["y"], [["x", 4], ["z", 4], ["y", 3]]),
  ],
}

describe("head to head", () => {
  it("counts wins against each other, and games as teammates", () => {
    const h = headToHead(state, "x", "z")
    expect(h.aWins).toBe(1)
    expect(h.bWins).toBe(1)
    expect(h.meetings.map((m) => m.aScore)).toEqual([5, 3])
    expect(h.aPts).toBe(4)
    expect(h.togetherWins).toBe(1)
    expect(h.togetherLosses).toBe(0)
  })

  it("reads the pair the same from either side", () => {
    const h = headToHead(state, "z", "x")
    expect(h.aWins).toBe(1)
    expect(h.meetings.map((m) => m.aScore)).toEqual([2, 6])
  })

  it("starts from the pair who have met most", () => {
    expect(mostMetPair(state)?.sort()).toEqual(["x", "z"])
  })
})
