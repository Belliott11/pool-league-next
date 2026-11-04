import { describe, expect, it } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
import { syncWinnerFlags } from "@/lib/winner"

const line = (playerId: string, pts: number) => ({ playerId, pts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 })
const game = (id: string, winner: Game["winner"], a: number, b: number, shots = 1): Game => ({
  id,
  date: "2026-08-16",
  winner,
  teamA: ["x"],
  teamB: ["y"],
  stats: [line("x", a), line("y", b)],
  scoringEvents: Array.from({ length: shots }, (_, i) => ({ id: `${id}${i}`, scorerId: "x", points: 1 as const })),
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
})
const state = (games: Game[]): PooleanState => ({ players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }], games })

describe("syncWinnerFlags", () => {
  it("corrects a flag that disagrees with a box-scored game's score", () => {
    const s = syncWinnerFlags(state([game("wrong", "A", 7, 18), game("right", "A", 19, 6)]))
    expect(s.games.map((g) => g.winner)).toEqual(["B", "A"])
  })

  it("leaves ties, unset flags, live games and games with no box score alone", () => {
    const live = { ...game("live", "A", 1, 9), liveInProgress: true }
    const input = state([game("tie", "A", 5, 5), game("unset", null, 1, 9), live, game("nobox", "A", 1, 9, 0)])
    expect(syncWinnerFlags(input)).toBe(input)
  })

  it("returns the same object when nothing changes", () => {
    const input = state([game("ok", "B", 3, 8)])
    expect(syncWinnerFlags(input)).toBe(input)
  })
})
