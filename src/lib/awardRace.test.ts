import { describe, expect, it } from "vitest"
import { awardRace } from "@/lib/awardRace"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const game = (id: string, date: string, a: string[], b: string[], scores: [string, number][]): Game => ({ ...base, id, date, teamA: a, teamB: b, liveScores: scores.map(([pid, points]) => ({ pid, points })) })
const state = (games: Game[], season?: string): PooleanState => ({ players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }], games, currentSeasonStartedAt: season ?? null })

describe("season award race", () => {
  it("ranks wins and finds the best duo from this season's games", () => {
    const games = [
      game("g1", "2026-10-01", ["x", "y"], ["z"], [["x", 6], ["z", 2]]),
      game("g2", "2026-10-08", ["x", "y"], ["z"], [["x", 5], ["z", 3]]),
      game("g3", "2026-10-15", ["x", "y"], ["z"], [["y", 7], ["z", 1]]),
    ]
    const rows = awardRace(state(games))
    const mvp = rows.find((r) => r.key === "mvp")!
    expect(mvp.leaders[0].value).toBe("3-0")
    expect(["x", "y"]).toContain(mvp.leaders[0].ids[0])
    expect(rows.find((r) => r.key === "best-duo")!.leaders[0]).toMatchObject({ ids: ["x", "y"], value: "3-0 together" })
  })

  it("leaves out games from before the season started", () => {
    const old = game("o1", "2026-01-01", ["z"], ["x"], [["z", 9], ["x", 1]])
    const rows = awardRace(state([old], "2026-06-01"))
    expect(rows).toEqual([])
  })
})
