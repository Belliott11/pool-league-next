import { describe, expect, it } from "vitest"
import { possessionOdds, tripRates } from "@/lib/shotChoice"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"
import { winChancePlays } from "@/lib/wpaPlays"

const shot = (id: string, scorerId: string, points: 2 | 3, made: boolean, t: number, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId, points, made, shotType: "drive", contestLevel: "medium", videoTime: t, ...extra })

// To 4, win by 2. A has the ball first. Every shot has a defender and every in-bounds miss a rebounder, so nothing goes uncredited.
const game: Game = {
  id: "g",
  date: "2026-07-01",
  liveTarget: 4,
  teamA: ["a1", "a2"],
  teamB: ["b1", "b2"],
  stats: [],
  scoringEvents: [
    shot("e1", "a1", 2, true, 1, { assistId: "a2", defenderIds: ["b1"] }), // 2-0
    shot("e2", "b1", 2, false, 2, { defenderIds: ["a1"], rebounderId: "a2" }), // A rebounds
    shot("e4", "b1", 2, true, 4, { defenderIds: ["a2"] }), // 2-2
    shot("e5", "a2", 3, false, 5, { defenderIds: ["b1"] }), // out of bounds (t2)
    shot("e6", "b2", 2, false, 6, { defenderIds: ["a1"], rebounderId: "b1" }), // B keeps it
    shot("e7", "b1", 2, false, 7, { defenderIds: ["a2"], rebounderId: "a1" }), // A rebounds
    shot("e8", "a1", 2, true, 8, { defenderIds: ["b2"] }), // 4-2, A wins
  ],
  turnoverEvents: [
    { id: "t1", playerId: "a1", opponentId: "b1", videoTime: 3 }, // a live-ball turnover, forced by b1
    { id: "t2", playerId: "a2", opponentId: "", missEventId: "e5", videoTime: 5 },
  ],
  stealEvents: [],
  foulEvents: [],
}
const state = { players: ["a1", "a2", "b1", "b2"].map((id) => ({ id, name: id })), games: [game] } as unknown as PooleanState
const w = winChancePlays(state)
const r = (id: string) => w.rows.find((x) => x.id === id)!

describe("win chance added, every play", () => {
  it("counts the game, since every play has a video time", () => {
    expect(w.games).toBe(1)
    expect(w.skipped).toBe(0)
  })

  it("adds back to how the game's win chance moved, on both sides", () => {
    const { t2, t3 } = tripRates(state)
    const start = possessionOdds(4, t2, t3)(0, 0, true) // A, with the ball at 0-0
    const a = r("a1").total + r("a2").total
    const b = r("b1").total + r("b2").total
    // Shots and turnovers are credited to both sides (the offense's gain is the defense's loss); a rebound only to who got it. So the
    // gap, with each side's boards counted a second time, is twice A's whole climb from the opening tip to the win.
    const boards = (r("a1").boards + r("a2").boards) - (r("b1").boards + r("b2").boards)
    expect(a - b + boards).toBeCloseTo(2 * (1 - start), 9)
  })

  it("puts each kind of play in its place", () => {
    expect(r("a1").turnovers).toBeLessThan(0) // turned it over
    expect(r("b1").defense).toBeGreaterThan(0) // forced it, and guarded the missed 3
    expect(r("a2").shots).toBeLessThan(0) // a 3 out of bounds
    expect(r("a2").passes).toBeGreaterThan(0) // the assist on e1
    expect(r("b1").boards).toBeGreaterThan(0) // kept a miss alive
    expect(r("a1").boards).toBeGreaterThan(0) // took one away
    expect(r("a1").shots).toBeGreaterThan(r("a2").shots)
  })
})
