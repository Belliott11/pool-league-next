import { describe, expect, it } from "vitest"
import fs from "node:fs"
import { yearOverYear } from "@/lib/yearOverYear"
import type { Game, PooleanState } from "@/lib/types"

const game = (id: string, date: string, a: string[], b: string[], winner: "A" | "B", made: [string, 2 | 3][] = []): Game =>
  ({ id, date, teamA: a, teamB: b, winner, stats: [], scoringEvents: made.map(([s, p], i) => ({ id: `${id}e${i}`, scorerId: s, points: p })), turnoverEvents: [], stealEvents: [], foulEvents: [] }) as unknown as Game

describe("this season against last", () => {
  it("needs two seasons and compares the same number of games", () => {
    const games = [
      game("o1", "2026-07-01", ["ben", "zach"], ["adam", "evan"], "A"),
      game("o2", "2026-07-08", ["ben", "zach"], ["adam", "evan"], "B"),
      game("o3", "2026-07-15", ["ben", "adam"], ["zach", "evan"], "A"),
      game("n1", "2027-06-02", ["ben", "evan"], ["adam", "zach"], "A"),
    ]
    const base = { players: [], games } as unknown as PooleanState
    expect(yearOverYear(base, "ben")).toBeNull()
    const two = { ...base, currentSeasonStartedAt: "2027-06-01", seasonHistory: [{ label: "Summer 2026", startedAt: null, endedAt: "2027-06-01" }] } as PooleanState
    const y = yearOverYear(two, "ben")!
    expect(y.lastLabel).toBe("Summer 2026")
    // One game this season, so only the first game of last season counts.
    expect(y.played).toBe(1)
    expect(y.record).toEqual({ now: [1, 0], then: [1, 0] })
  })
})

describe.skipIf(!fs.existsSync("public/test-data.json"))("this season against last (live data split into two)", () => {
  it("fills every row from filmed games", () => {
    const state = JSON.parse(fs.readFileSync("public/test-data.json", "utf8")) as PooleanState
    const split = { ...state, currentSeasonStartedAt: "2026-08-10", seasonHistory: [{ label: "Early summer", startedAt: null, endedAt: "2026-08-10" }] }
    const y = yearOverYear(split, "ben")
    expect(y).not.toBeNull()
    expect(y!.filmed).toBeGreaterThan(0)
    for (const r of y!.rows) {
      expect(r.now).not.toBeNull()
      expect(r.then).not.toBeNull()
    }
  })
})
