import { describe, expect, it } from "vitest"
import { assignmentsAt, coversTwo, sameAsLast, setAssignment, tipoffStatus } from "@/lib/matchupSets"
import type { Game } from "@/lib/types"

const base = { stats: [], turnoverEvents: [], stealEvents: [], foulEvents: [], scoringEvents: [{ id: "s", scorerId: "a1", points: 2 as const, made: true, videoTime: 100 }] }
const game = (extra: Partial<Game> = {}): Game => ({ ...base, id: "g", date: "2026-08-10", teamA: ["a1", "a2"], teamB: ["b1", "b2"], videoStart: 90, matchups: [], ...extra })

describe("matchup sets", () => {
  it("counts who is assigned at tip-off and who is missing", () => {
    let g = setAssignment(game(), "a1", ["b1"], 90)
    g = setAssignment(g, "b1", ["a1"], 90)
    expect(tipoffStatus(g)).toEqual({ assigned: 2, total: 4, missing: ["a2", "b2"] })
    expect(tipoffStatus(game()).assigned).toBe(0)
  })
  it("holds an assignment until a newer one, and only at or before the time asked", () => {
    let g = setAssignment(game(), "a1", ["b1"], 90)
    g = setAssignment(g, "a1", ["b2"], 400)
    expect(assignmentsAt(g, 200).get("a1")).toEqual(["b1"])
    expect(assignmentsAt(g, 500).get("a1")).toEqual(["b2"])
    expect(assignmentsAt(g).get("a1")).toEqual(["b2"])
  })
  it("replaces a defender's entry at the same time instead of stacking", () => {
    let g = setAssignment(game(), "a1", ["b1"], 90)
    g = setAssignment(g, "a1", ["b2"], 90)
    expect(g.matchups).toHaveLength(1)
  })
  it("lets a defender on the smaller team cover two offenders", () => {
    const g = game({ teamA: ["a1"], teamB: ["b1", "b2"] })
    expect(coversTwo(g, "a1")).toBe(true)
    expect(coversTwo(g, "b1")).toBe(false)
    expect(assignmentsAt(setAssignment(g, "a1", ["b1", "b2"], 90)).get("a1")).toEqual(["b1", "b2"])
  })
  it("ignores someone on the same team, and carries every assignment over", () => {
    let g = setAssignment(game(), "a1", ["a2"], 90)
    expect(g.matchups).toHaveLength(0)
    g = setAssignment(setAssignment(game(), "a1", ["b1"], 90), "b1", ["a1"], 90)
    const next = sameAsLast(g, 500)
    expect(assignmentsAt(next, 500).get("a1")).toEqual(["b1"])
    expect(next.matchups).toHaveLength(4)
  })
})
