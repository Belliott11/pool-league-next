import { describe, expect, it } from "vitest"
import { matchupRecord } from "@/lib/matchupRecord"
import type { Game, PooleanState } from "@/lib/types"

const shot = (id: string, scorerId: string, o: Partial<Game["scoringEvents"][number]> = {}) => ({ id, scorerId, points: 2 as const, made: true, ...o })
const game = (o: Partial<Game>): Game => ({ id: "g", date: "2026-08-10", teamA: ["a", "b"], teamB: ["x", "y"], winner: "A", stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], ...o })
const state = (g: Game): PooleanState => ({ players: [], games: [g] })

describe("matchup record", () => {
  it("credits tagged defenders and keeps beat shots out of the make rate", () => {
    const g = game({
      scoringEvents: [shot("1", "x", { defenderIds: ["a"] }), shot("2", "x", { defenderIds: ["a"], made: false }), shot("3", "x", { defenderIds: ["a"], contestLevel: "beat" })],
    })
    const [p] = matchupRecord(state(g))
    expect(p).toMatchObject({ defenderId: "a", scorerId: "x", shots: 3, beat: 1, held: 2, made: 1, fromMatchups: 0 })
  })
  it("falls back to the matchups list for an untagged shot, at the moment it was taken", () => {
    const g = game({
      matchups: [
        { id: "m1", defenderId: "a", offenderId: "x", note: "", videoTime: 0 },
        { id: "m2", defenderId: "b", offenderId: "x", note: "", videoTime: 100 },
        { id: "m3", defenderId: "b", offenderId: "y", note: "", videoTime: 0 },
      ],
      scoringEvents: [shot("1", "x", { videoTime: 50, contestLevel: "light" }), shot("2", "x", { videoTime: 150, contestLevel: "heavy" })],
    })
    const r = matchupRecord(state(g))
    expect(r.find((p) => p.defenderId === "a" && p.scorerId === "x")?.fromMatchups).toBe(2)
    expect(r.find((p) => p.defenderId === "b" && p.scorerId === "x")?.shots).toBe(1)
  })
  it("charges nobody through the matchups list for a shot with no contest logged", () => {
    const g = game({
      matchups: [{ id: "m1", defenderId: "a", offenderId: "x", note: "", videoTime: 0 }],
      scoringEvents: [shot("1", "x", { videoTime: 50, contestLevel: "none" }), shot("2", "x", { videoTime: 60 }), shot("3", "x", { videoTime: 70, defenderIds: ["a"], contestLevel: "none" })],
    })
    // Only the tagged shot counts: a tag says who was there even when nobody contested.
    expect(matchupRecord(state(g))).toMatchObject([{ defenderId: "a", scorerId: "x", shots: 1, fromMatchups: 0 }])
  })
})
