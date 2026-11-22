import { describe, expect, it, afterAll } from "vitest"
import { awardRace, shownAwards } from "@/lib/awardRace"
import type { Game, PooleanState } from "@/lib/types"
import { DEFAULT_FILTERS, setFilters } from "@/lib/filters"

// These fixtures use uneven teams on purpose, so the Include imbalanced games filter is on for them.
setFilters({ imbalanced: true }) // set now, not in beforeAll, because some of these answers are worked out while the file loads
afterAll(() => setFilters(DEFAULT_FILTERS))

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const game = (id: string, date: string, a: string[], b: string[], scores: [string, number][]): Game => ({ ...base, id, date, teamA: a, teamB: b, liveScores: scores.map(([pid, points]) => ({ pid, points })) })
const state = (games: Game[], season?: string): PooleanState => ({ players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }], games, currentSeasonStartedAt: season ?? null })

describe("season award race", () => {
  it("leaves out a race with fewer than three in it, but still works it out (predictions use it)", () => {
    const two = Array.from({ length: 5 }, (_, i) => game(`t${i}`, `2026-10-0${i + 1}`, ["x"], ["y"], [["x", 6], ["y", 2]]))
    const rows = awardRace(state(two))
    expect(rows.find((r) => r.key === "best-player")).toMatchObject({ field: 2 })
    expect(shownAwards(rows).find((r) => r.key === "best-player")).toBeUndefined()
    const three = Array.from({ length: 5 }, (_, i) => game(`h${i}`, `2026-10-0${i + 1}`, ["x", "y"], ["z"], [["x", 6], ["z", 2]]))
    expect(shownAwards(awardRace(state(three))).find((r) => r.key === "best-player")).toMatchObject({ field: 3 })
  })

  it("ranks wins and finds the best duo from this season's games", () => {
    // Five games together, so both clear the bar every award race has for games played.
    const games = Array.from({ length: 5 }, (_, i) => game(`g${i}`, `2026-10-0${i + 1}`, ["x", "y"], ["z"], [[i % 2 ? "y" : "x", 6], ["z", 2]]))
    const rows = awardRace(state(games))
    expect(rows.find((r) => r.key === "best-duo")!.leaders[0]).toMatchObject({ ids: ["x", "y"], value: "5-0 together" })
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
    const rows = awardRace(state(Array.from({ length: 5 }, (_, i) => box(`b${i}`, `2026-10-0${i + 1}`, i % 2 ? 9 : 10, 2))))
    const mvp = rows.find((r) => r.key === "mvp")!
    expect(mvp.basis).toBe("Total two-way score")
    expect(mvp.leaders[0].ids).toEqual(["x"])
    expect(mvp.leaders[0].value).toMatch(/over 5 games/)
    expect(rows.find((r) => r.key === "dpoy")!.basis).toBe("Total defensive score")
  })

  it("keeps a newcomer out of every award until they have five games", () => {
    const box = (id: string, date: string, withY: boolean): Game => ({
      ...base, id, date, teamA: ["x"], teamB: [withY ? "y" : "z"], scoringEvents: [{ id: "e" + id } as never],
      stats: [
        { playerId: "x", pts: 9, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
        { playerId: withY ? "y" : "z", pts: 20, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
      ],
    })
    // x plays all five. y scores a lot in 2 games and z has 3, so neither is on the board.
    const rows = awardRace(state(Array.from({ length: 5 }, (_, i) => box(`n${i}`, `2026-10-0${i + 1}`, i < 2))))
    const ids = rows.flatMap((r) => r.leaders.flatMap((l) => l.ids))
    expect(ids).toContain("x")
    expect(ids).not.toContain("y")
    expect(ids).not.toContain("z")
  })

  it("leaves out games from before the season started", () => {
    const old = game("o1", "2026-01-01", ["z"], ["x"], [["z", 9], ["x", 1]])
    const rows = awardRace(state([old], "2026-06-01"))
    expect(rows).toEqual([])
  })
})
