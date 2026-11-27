import { describe, expect, it } from "vitest"
import { answer, playerIn } from "./statAnswers"
import type { Game, PooleanState } from "./types"

const game = (id: string, date: string, a: string[], b: string[], pts: Record<string, number>, ast: Record<string, number> = {}): Game =>
  ({
    id, date, teamA: a, teamB: b, winner: "A",
    stats: Object.entries(pts).map(([playerId, p]) => ({ playerId, pts: p, oreb: 0, dreb: 1, ast: ast[playerId] ?? 0, stl: 0, blk: 0, tov: 0, pf: 0 })),
    scoringEvents: Object.entries(pts).flatMap(([pid, p]) => Array.from({ length: p / 2 }, (_, i) => ({ id: `${id}${pid}${i}`, scorerId: pid, points: 2, made: true }))),
    turnoverEvents: [], stealEvents: [], foulEvents: [],
  }) as unknown as Game
const state = {
  players: [{ id: "ben", name: "Ben" }, { id: "zach", name: "Zach" }, { id: "g-ian", name: "Ian" }],
  games: [game("g1", "2027-06-01", ["ben"], ["zach"], { ben: 10, zach: 4 }, { ben: 3 }), game("g2", "2027-06-08", ["ben"], ["zach"], { ben: 6, zach: 12 }, { zach: 1 })],
} as unknown as PooleanState

describe("stat answers", () => {
  it("finds the player a question names", () => {
    expect(playerIn(state, "ben's best game")).toBe("ben")
    expect(playerIn(state, "what about ian")).toBe("g-ian")
    expect(playerIn(state, "benchmark")).toBeNull()
  })
  it("answers single-game records and a player's best game", () => {
    expect(answer(state, "most points in a game")[0].label).toBe("Zach: 12 points")
    const best = answer(state, "ben's best game")[0]
    expect(best.label).toContain("Ben: 10 points")
    expect(best.target).toEqual({ kind: "game", id: "g1" })
  })
  it("answers career leaders and averages without mixing in records", () => {
    expect(answer(state, "career points").map((a) => a.label)).toEqual(["Ben and Zach: 16 points"])
    expect(answer(state, "ben points per game").map((a) => a.label)).toEqual(["Ben: 8.0 points a game"])
    expect(answer(state, "zach assists in a game")[0].label).toBe("Zach: 1 assist")
  })
  it("stays quiet on things that are not questions", () => {
    expect(answer(state, "ben")).toEqual([])
    expect(answer(state, "games")).toEqual([])
  })
})
