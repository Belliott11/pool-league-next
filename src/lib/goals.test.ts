import { describe, expect, it } from "vitest"
import { goalSeason, progress } from "./goals"
import type { Game, PooleanState } from "./types"

const g = (id: string, date: string, pts: number, threes: [number, number]): Game =>
  ({
    id, date, teamA: ["p", "q"], teamB: ["x"], winner: "A",
    stats: [{ playerId: "p", pts, oreb: 1, dreb: 0, ast: 2, stl: 0, blk: 0, tov: 0, pf: 0 }],
    scoringEvents: [
      ...Array.from({ length: threes[1] }, (_, i) => ({ id: `${id}t${i}`, scorerId: "p", points: 3, made: i < threes[0] })),
      { id: `${id}x`, scorerId: "x", points: 2, made: false },
    ],
    turnoverEvents: [], stealEvents: [], foulEvents: [],
  }) as unknown as Game
const state = { players: [], games: [g("a", "2027-06-01", 6, [2, 5]), g("b", "2027-06-08", 9, [3, 6]), g("c", "2026-07-01", 30, [10, 10])], openingNight: { date: "2027-06-01" } } as unknown as PooleanState

describe("goals", () => {
  it("counts only the season's games", () => {
    expect(goalSeason(state)).toBe("2027")
    const p = progress(state, { goal: "ppg", target: 10, player: "p", season: "2027" })
    expect(p.value).toBe(7.5)
    expect(p.share).toBeCloseTo(0.75)
    expect(p.done).toBe(false)
  })
  it("needs enough shots before a percentage counts as done", () => {
    const p = progress(state, { goal: "threePct", target: 40, player: "p", season: "2027" })
    expect(Math.round(p.value!)).toBe(45)
    expect(p.done).toBe(false)
    expect(p.text).toContain("needs 15")
  })
  it("marks a single-game goal done once reached", () => {
    expect(progress(state, { goal: "gamePts", target: 9, player: "p", season: "2027" }).done).toBe(true)
  })
})
