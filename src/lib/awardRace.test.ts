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
    expect(rows.find((r) => r.key === "best-duo")!.leaders[0]).toMatchObject({ ids: ["x", "y"], value: "3-0 together" })
  })

  it("gives MVP to total two-way score over the season, from box-scored games", () => {
    const box = (id: string, date: string, xPts: number, yPts: number): Game => ({
      ...base,
      id,
      date,
      teamA: ["x"],
      teamB: ["y"],
      scoringEvents: [{ id: "e" + id } as never],
      stats: [
        { playerId: "x", pts: xPts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
        { playerId: "y", pts: yPts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
      ],
    })
    const rows = awardRace(state([box("a", "2026-10-01", 10, 2), box("b", "2026-10-08", 9, 3)]))
    const mvp = rows.find((r) => r.key === "mvp")!
    expect(mvp.basis).toBe("Total two-way score")
    expect(mvp.leaders[0].ids).toEqual(["x"])
    expect(mvp.leaders[0].value).toMatch(/over 2 games/)
    expect(rows.find((r) => r.key === "dpoy")!.basis).toBe("Total defensive score")
  })

  it("leaves out games from before the season started", () => {
    const old = game("o1", "2026-01-01", ["z"], ["x"], [["z", 9], ["x", 1]])
    const rows = awardRace(state([old], "2026-06-01"))
    expect(rows).toEqual([])
  })
})
