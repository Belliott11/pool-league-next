import { describe, expect, it } from "vitest"
import { previewStoriesFor, upcomingRsvp } from "@/lib/nightPreview"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const game = (id: string, date: string, a: string[], b: string[], scores: [string, number][]): Game => ({ ...base, id, date, teamA: a, teamB: b, liveScores: scores.map(([pid, points]) => ({ pid, points })) })
const name = (id: string) => id.toUpperCase()

// Five nights of X (team A) against Z; X wins the first four.
const games = [
  game("g1", "2026-09-01", ["x"], ["z"], [["x", 5], ["z", 2]]),
  game("g2", "2026-09-08", ["x"], ["z"], [["x", 6], ["z", 3]]),
  game("g3", "2026-09-15", ["x"], ["z"], [["x", 7], ["z", 4]]),
  game("g4", "2026-09-22", ["x"], ["z"], [["x", 8], ["z", 1]]),
  game("g5", "2026-09-29", ["x"], ["z"], [["z", 9], ["x", 2]]),
]
const state: PooleanState = { players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }], games, rsvps: [{ id: "r1", date: "2026-10-06", playerIds: ["z", "y"] }] }

describe("night preview", () => {
  it("picks the next RSVP that is today or later", () => {
    expect(upcomingRsvp(state, "2026-10-05")?.id).toBe("r1")
    expect(upcomingRsvp(state, "2026-10-07")).toBeNull()
  })

  it("asks about a regular who is not on the list", () => {
    const out = previewStoriesFor(state, ["z", "y"], name).join(" ")
    expect(out).toContain("X")
    expect(out).toMatch(/list|RSVP|nights/)
  })

  it("notes a pair on the list with a lopsided history", () => {
    const out = previewStoriesFor(state, ["x", "z"], name).join(" ")
    expect(out).toMatch(/4-1|1-4/)
  })
})
