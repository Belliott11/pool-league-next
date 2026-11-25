import { describe, expect, it } from "vitest"
import { defenseTable, playerDefense, PRIOR_SHOTS } from "@/lib/playerDefense"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

let n = 0
const shot = (scorerId: string, made: boolean, defenderIds: string[], more: Partial<ScoringEvent> = {}): ScoringEvent => ({ id: `s${n++}`, scorerId, points: 2, made, defenderIds, ...more }) as ScoringEvent
const game = (scoringEvents: ScoringEvent[]): Game =>
  ({ id: `g${n++}`, date: "2026-08-01", teamA: ["a1", "a2"], teamB: ["b1", "b2"], scoringEvents, turnoverEvents: [], stealEvents: [], foulEvents: [], stats: [], winner: "A" }) as unknown as Game

describe("who stops whom", () => {
  // a1 makes everything against b2 and nothing against b1.
  const g = game([
    ...[1, 2, 3, 4].map(() => shot("a1", false, ["b1"])),
    ...[1, 2, 3, 4].map(() => shot("a1", true, ["b2"])),
    shot("b1", true, ["a1", "a2"], { contestLevel: "heavy" }),
  ])
  const t = defenseTable({ games: [g] } as unknown as PooleanState)
  it("judges a defender against what the shooter scores on everyone else", () => {
    // League: 5 makes of 9 shots, 10 points: 10/9 a shot. a1 against everyone but b1: 8 points on 4 shots.
    const usual = (8 + PRIOR_SHOTS * (10 / 9)) / (4 + PRIOR_SHOTS)
    const p = t.pairs.find((x) => x.defenderId === "b1" && x.scorerId === "a1")!
    expect(p.usual).toBeCloseTo(usual, 10)
    expect(p.saved).toBeCloseTo(usual * 4, 10)
    expect(t.defenders[0].id).toBe("b1")
  })
  it("splits a shot guarded by two people", () => {
    const a2 = t.defenders.find((d) => d.id === "a2")!
    expect(a2.shots).toBe(0.5)
    expect(a2.heavy).toBe(0.5)
  })
  it("lists the pairs from both sides", () => {
    const d = playerDefense(t, "a1")
    expect(d.guardedBy.map((p) => p.defenderId)).toEqual(["b1", "b2"])
    expect(playerDefense(t, "b1").guarding[0].scorerId).toBe("a1")
  })
})
