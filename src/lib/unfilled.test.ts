import { describe, expect, it } from "vitest"
import { findUnfilled } from "@/lib/unfilled"
import type { Game, PooleanState } from "@/lib/types"

const shot = (id: string, o: Partial<Game["scoringEvents"][number]> = {}) => ({ id, scorerId: "x", points: 2 as const, made: true, ...o })
const game = (o: Partial<Game>): Game => ({ id: "g", date: "2026-08-10", teamA: ["a"], teamB: ["x"], winner: "A", stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], ...o })
const state = (...games: Game[]): PooleanState => ({ players: [], games })

describe("what is still unfilled", () => {
  it("lists a game with no tip-off matchups and shots missing a contest level", () => {
    const g = game({ scoringEvents: [shot("1", { defenderIds: ["a"] }), shot("2", { defenderIds: ["a"], contestLevel: "light" }), shot("3")] })
    expect(findUnfilled(state(g))).toEqual([{ gameId: "g", date: "2026-08-10", tipoff: { assigned: 0, total: 2 }, noContest: 1, shots: 2 }])
  })
  it("leaves out a game with everything filled and a game with no shots", () => {
    const full = game({
      matchups: [
        { id: "m1", defenderId: "a", offenderId: "x", note: "", videoTime: 0 },
        { id: "m2", defenderId: "x", offenderId: "a", note: "", videoTime: 0 },
      ],
      scoringEvents: [shot("1", { defenderIds: ["a"], contestLevel: "heavy", videoTime: 0 })],
    })
    expect(findUnfilled(state(full, game({ id: "empty" })))).toEqual([])
  })
})
