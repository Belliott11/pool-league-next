import { describe, expect, it } from "vitest"
import { statCheck } from "@/lib/statCheck"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const ev = (id: string, scorerId: string, made: boolean, o: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId, points: 2, made, ...o })
const game = (id: string, evs: ScoringEvent[], tovs: Game["turnoverEvents"] = []): Game => ({ id, date: "d", teamA: ["a"], teamB: ["b"], winner: "A", stats: [], scoringEvents: evs, turnoverEvents: tovs, stealEvents: [], foulEvents: [] })

describe("stat check", () => {
  it("counts how often the team better on a stat won, leaving out games where both are even", () => {
    // a wins both games. In g1 a has fewer live turnovers; in g2 both have none.
    const g1 = game("g1", [ev("1", "a", true), ev("2", "b", false)], [{ id: "t", playerId: "b" } as Game["turnoverEvents"][number]])
    const g2 = game("g2", [ev("3", "a", true), ev("4", "a", true), ev("5", "b", true)])
    const st: PooleanState = { players: [], games: [g1, g2] }
    const tov = statCheck(st).find((r) => r.id === "livetov")!
    expect([tov.wins, tov.games]).toEqual([1, 1])
    expect(tov.verdict).toBe("early")
  })
})
