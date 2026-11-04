import { describe, expect, it } from "vitest"
import { gamesNeeded, ratings, ratingsWithTrend } from "@/lib/ratings"
import type { Game, PlayerGameStats, PooleanState } from "@/lib/types"

const line = (playerId: string, pts: number, ast = 0, dreb = 0): PlayerGameStats => ({ playerId, pts, oreb: 0, dreb, ast, stl: 0, blk: 0, tov: 0, pf: 0 })
// A box-scored 1 v 1 v 1 v 1 game: x and y against z and w, with each player's line given.
const game = (id: string, date: string, lines: PlayerGameStats[]): Game => ({
  id,
  date,
  teamA: ["x", "y"],
  teamB: ["z", "w"],
  stats: lines,
  scoringEvents: [{ id: "e" + id, scorerId: "x", points: 1 }],
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
})
const state = (games: Game[]): PooleanState => ({ players: ["x", "y", "z", "w"].map((id) => ({ id, name: id })), games })
const week = (n: number) => `2026-07-${String(n + 1).padStart(2, "0")}`
const season = (n: number) => Array.from({ length: n }, (_, i) => game(String(i), week(i), [line("x", 9, 3, 2), line("y", 3, 1, 1), line("z", 5, 2, 3), line("w", 4, 0, 1)]))

describe("ratings", () => {
  it("needs 5 box-scored games", () => {
    expect(ratings(state(season(4)))).toEqual([])
    expect(gamesNeeded(state(season(4)), "x")).toBe(1)
    expect(ratings(state(season(5)))).toHaveLength(4)
  })

  it("rates the better player higher and averages around 74", () => {
    const r = ratings(state(season(6)))
    const by = Object.fromEntries(r.map((x) => [x.id, x]))
    expect(r[0].id).toBe("x")
    expect(by.x.ovr).toBeGreaterThan(by.y.ovr)
    expect(by.x.attrs.scoring!).toBeGreaterThan(by.y.attrs.scoring!)
    expect(by.z.attrs.rebounding!).toBeGreaterThan(by.y.attrs.rebounding!)
    const avg = r.reduce((a, x) => a + x.ovr, 0) / r.length
    expect(Math.abs(avg - 74)).toBeLessThanOrEqual(1)
    // Fewer than 10 shots logged, so there is no shooting rating rather than a made-up one.
    expect(by.x.attrs.shooting).toBeNull()
  })

  it("moves after a big night", () => {
    const games = [...season(6), game("big", week(10), [line("x", 2), line("y", 20, 5, 5), line("z", 2), line("w", 1)])]
    const t = ratingsWithTrend(state(games))
    expect(t.since).toBe(week(10))
    expect(t.rows.find((r) => r.id === "y")!.change!).toBeGreaterThan(0)
    expect(t.rows.find((r) => r.id === "x")!.change!).toBeLessThanOrEqual(0)
  })
})
