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
  // Ten games: a is in all of them, b in the first five and c in the last five, so all three clear the five-game bar.
  const game = (i: number, withB: boolean) => ({
    id: `g${i}`, date: `2026-01-${String(i + 1).padStart(2, "0")}`, teamA: ["a"], teamB: [withB ? "b" : "c"],
    stats: [stat("a", 6), stat(withB ? "b" : "c", 2)],
    scoringEvents: [shot("a"), shot("a"), shot("a"), shot(withB ? "b" : "c")],
    turnoverEvents: [],
  })
  const s = projectSeason({ players: [], games: Array.from({ length: 10 }, (_, i) => game(i, i < 5)) } as unknown as PooleanState, 10, 300)
  expect(s.games).toBe(10)
  expect(s.mvp[0].id).toBe("a")
  expect(s.mvp[0].win).toBeGreaterThan(0.9)
  expect(s.mvp.reduce((t, p) => t + p.win, 0)).toBeCloseTo(1)
  const a = s.milestones.find((m) => m.id === "a")!
  expect(a).toMatchObject({ pts: 60, next: 100 })
  expect(a.chance).toBeGreaterThan(0.9) // 60 now plus 6 a game over 10 games
  expect(s.mvp[0].lo).toBeLessThanOrEqual(s.mvp[0].mid)
})

test("a newcomer under five games is left out of the projection", () => {
  // Even teams throughout: a, b and c play all six, "new" plays the first three and "old" the last three.
  const game = (i: number) => ({
    id: `n${i}`, date: `2026-01-${String(i + 1).padStart(2, "0")}`, teamA: ["a", i < 3 ? "new" : "old"], teamB: ["b", "c"],
    stats: [stat("a", 4), stat("b", 2), stat("c", 2), stat(i < 3 ? "new" : "old", 2)],
    scoringEvents: [shot("a"), shot("a"), shot("b"), shot("c"), shot(i < 3 ? "new" : "old")], turnoverEvents: [],
  })
  const s = projectSeason({ players: [], games: Array.from({ length: 6 }, (_, i) => game(i)) } as unknown as PooleanState, 5, 100)
  expect(s.mvp.map((p) => p.id).sort()).toEqual(["a", "b", "c"])
})

test("per-game rates: the same line in a long, sloppy game counts for less than in a short one", async () => {
  const { gamePace, setPaceGames, PER } = await import("@/lib/per")
  const mk = (id: string, misses: number) => ({
    id, date: "2026-01-01", teamA: ["a"], teamB: ["b"], stats: [stat("a", 4), stat("b", 4)],
    scoringEvents: [shot("a"), shot("a"), shot("b"), shot("b"), ...Array.from({ length: misses }, () => shot("b", false))],
    turnoverEvents: [],
  }) as never
  const short = mk("s", 0) // 4 trips
  const long = mk("l", 8) // 12 trips, the same 8 points
  setPaceGames([short, long]) // an average game is 8 trips
  expect(gamePace(short, 8)).toBeCloseTo(PER / 2)
  expect(gamePace(long, 8)).toBeCloseTo(PER * 1.5)
  // A game with no shot log has no trips, so it falls back to its points.
  expect(gamePace({ ...(short as object), scoringEvents: [] } as never, 8)).toBe(8)
  setPaceGames([])
})

test("a double team splits the shot between its defenders, so each carries half", async () => {
  const { gameDefenseStats } = await import("@/lib/stats")
  const g = { id: "d", teamA: ["a"], teamB: ["b", "c"], scoringEvents: [shot("a", true, { defenderIds: ["b", "c"] }), shot("a", false, { defenderIds: ["b"] })] } as never
  expect(gameDefenseStats(g, "b")).toMatchObject({ timesBeaten: 0.5, stops: 1, ptsAllowed: 1 })
  expect(gameDefenseStats(g, "c")).toMatchObject({ timesBeaten: 0.5, stops: 0, ptsAllowed: 1 })
})

test("projection: sample ballots give the vote to the clear leader most of the time, and shares add up to 1", () => {
  const ids = ["a", "b", "c", "d"]
  const game = (i: number) => ({
    id: `v${i}`, date: `2026-02-0${i + 1}`, teamA: ["a", "b"], teamB: ["c", "d"],
    stats: ids.map((id) => stat(id, id === "a" ? 8 : 2)),
    scoringEvents: [shot("a"), shot("a"), shot("a"), shot("a"), shot("b"), shot("c"), shot("d")],
    turnoverEvents: [],
  })
  const s = projectSeason({ players: [], games: [0, 1, 2, 3, 4, 5].map(game) } as unknown as PooleanState, 5, 200)
  expect(s.mvp.reduce((t, p) => t + p.vote, 0)).toBeCloseTo(1)
  expect(s.mvp.find((p) => p.id === "a")!.vote).toBeGreaterThan(0.5)
  expect(s.mvp.every((p) => p.vote >= 0 && p.vote <= 1)).toBe(true)
})
