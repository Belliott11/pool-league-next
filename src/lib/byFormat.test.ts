import { describe, expect, it } from "vitest"
import { byFormat, formatOf } from "@/lib/byFormat"
import type { Game, PooleanState } from "@/lib/types"

const shot = (id: string, scorerId: string, o: Partial<Game["scoringEvents"][number]> = {}) => ({ id, scorerId, points: 2 as const, made: true, ...o })
const game = (o: Partial<Game>): Game => ({ id: "g", date: "2026-08-10", teamA: ["a", "b"], teamB: ["x", "y"], winner: "A", stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], ...o })
const state = (...games: Game[]): PooleanState => ({ players: [], games })

describe("by format", () => {
  it("names formats by team size and pools uneven teams", () => {
    expect(formatOf(["a", "b"], ["x", "y"])).toBe("2v2")
    expect(formatOf(["a", "b", "c"], ["x", "y"])).toBe("Uneven")
  })
  it("counts rates per format, with turnovers out of trips that ended in a shot or a turnover", () => {
    const g = game({
      scoringEvents: [
        shot("1", "a", { points: 3, assistId: "b" }),
        shot("2", "x", { made: false, rebounderId: "y" }), // offensive rebound
        shot("3", "y", { contestLevel: "heavy" }),
      ],
      turnoverEvents: [{ id: "t", playerId: "a" } as Game["turnoverEvents"][number]],
    })
    const [r] = byFormat(state(g), [])
    expect(r.format).toBe("2v2")
    expect(r.filmed).toBe(1)
    expect(r.turnovers).toEqual({ n: 1, d: 4 })
    expect(r.threes).toEqual({ n: 1, d: 3 })
    expect(r.assisted).toEqual({ n: 1, d: 2 })
    expect(r.oreb).toEqual({ n: 1, d: 1 })
    expect(r.contestedMade).toEqual({ n: 1, d: 1 })
    expect(r.margin).toEqual({ n: 1, d: 5 }) // 3 to 2
  })
  it("counts old-site results without double counting a filmed game", () => {
    const g = game({ scoringEvents: [shot("1", "a")] })
    const old = [{ n: 1, date: "2026-08-10", a: ["b", "a"], b: ["x", "y"], w: "A" as const }, { n: 2, date: "2026-08-10", a: ["a", "b"], b: ["x", "y"], w: "B" as const }]
    expect(byFormat(state(g), old)[0].results).toBe(2)
  })
})
