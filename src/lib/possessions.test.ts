import { expect, test } from "vitest"
import { possessions } from "@/lib/possessions"
import { projectSeason } from "@/lib/projections"
import type { PooleanState } from "@/lib/types"

let n = 0
const shot = (scorerId: string, made = true, extra: object = {}) => ({ id: `e${n++}`, scorerId, points: 2 as const, made, ...extra })
const stat = (playerId: string, pts: number) => ({ playerId, pts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 })

test("a trip is a shot or a live-ball turnover, and an offensive rebound keeps it going", () => {
  // a: make, miss kept by teammate c (same trip), make, live turnover = 3 shots - 1 + 1 = 3 trips, 4 points.
  // b: one miss rebounded by a (the trip ends), and a turnover tied to a shot (not a second trip) = 1 trip, 0 points.
  const g = {
    id: "g", date: "2026-01-01", teamA: ["a", "c"], teamB: ["b", "d"],
    stats: [stat("a", 4), stat("b", 0)],
    scoringEvents: [shot("a"), shot("a", false, { rebounderId: "c" }), shot("a"), shot("b", false, { rebounderId: "a", turnoverEventId: "t2" })],
    turnoverEvents: [{ id: "t1", playerId: "a" }, { id: "t2", playerId: "b", missEventId: "x" }],
  }
  const { rows, league } = possessions({ players: [], games: [g] } as unknown as PooleanState)
  const a = rows.find((r) => r.id === "a")!
  expect(a).toMatchObject({ trips: 3, teamPts: 4, oppTrips: 1, oppPts: 0, used: 4, pts: 4, tov: 1, teamEnds: 4 })
  expect(rows.find((r) => r.id === "c")).toMatchObject({ trips: 3, used: 0 })
  expect(league).toEqual({ trips: 4, pts: 4, games: 1 })
})

test("projection: the player who scores more and shows up more is the favorite, and odds add up to 1", () => {
  const game = (i: number, withB: boolean) => ({
    id: `g${i}`, date: `2026-01-0${i + 1}`, teamA: ["a"], teamB: [withB ? "b" : "c"],
    stats: [stat("a", 6), stat(withB ? "b" : "c", 2)],
    scoringEvents: [shot("a"), shot("a"), shot("a"), shot(withB ? "b" : "c")],
    turnoverEvents: [],
  })
  const s = projectSeason({ players: [], games: [game(0, true), game(1, true), game(2, false), game(3, false)] } as unknown as PooleanState, 10, 300)
  expect(s.games).toBe(4)
  expect(s.mvp[0].id).toBe("a")
  expect(s.mvp[0].win).toBeGreaterThan(0.9)
  expect(s.mvp.reduce((t, p) => t + p.win, 0)).toBeCloseTo(1)
  const a = s.milestones.find((m) => m.id === "a")!
  expect(a).toMatchObject({ pts: 24, next: 50 })
  expect(a.chance).toBeGreaterThan(0.9) // 24 now plus 6 a game over 10 games
  expect(s.mvp[0].lo).toBeLessThanOrEqual(s.mvp[0].mid)
})
