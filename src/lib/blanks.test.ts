import { describe, expect, it } from "vitest"
import { findBlanks } from "@/lib/blanks"
import type { Game, ScoringEvent } from "@/lib/types"

const shot = (id: string, o: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId: "a", points: 2, made: false, shotType: "drive", shotLocation: { x: 50, y: 10 }, rebounderId: "b", contestLevel: "heavy", ...o })
const game = (evs: ScoringEvent[]): Game => ({ id: "g", date: "d", teamA: ["a", "p"], teamB: ["b"], winner: "A", stats: [], scoringEvents: evs, turnoverEvents: [], stealEvents: [], foulEvents: [] })
const kinds = (evs: ScoringEvent[]) => findBlanks({ players: [], games: [game(evs)] }).map((b) => `${b.eventId}:${b.kind}`)

describe("catch and shoot blanks", () => {
  it("asks only about contested shots off a teammate's pass that are not tagged yet", () => {
    expect(kinds([shot("open", { passerId: "p", contestLevel: "light" })])).toEqual([])
    expect(kinds([shot("miss", { passerId: "p" })])).toEqual(["miss:catch"])
    expect(kinds([shot("make", { made: true, assistId: "p", passerId: "p", rebounderId: null })])).toEqual(["make:catch"])
    expect(kinds([shot("self", { passerId: "none" }), shot("unset"), shot("done", { passerId: "p", catchAndShoot: false })])).toEqual([])
  })
})
