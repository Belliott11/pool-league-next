import { describe, expect, it } from "vitest"
import { findBlanks } from "@/lib/blanks"
import { bodyEffort, correlate } from "@/lib/bodyEffort"
import { playerIdentity } from "@/lib/playerIdentity"
import { sequences } from "@/lib/sequences"
import { shrink, trustOf, wilson } from "@/lib/trust"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"
import { defensiveRating, gameDefenseStats, getGameStats } from "@/lib/stats"
import { fit, results, splits, winImpact, type Result } from "@/lib/winImpact"

const shot = (id: string, scorerId: string, t: number, made: boolean, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId, points: 2, made, videoTime: t, shotType: "drive", contestLevel: "none", shotLocation: { x: 50, y: 10 }, passerId: "none", ...extra })
// a misses, a rebounds it and puts it back (t 10), b answers (t 20), b gives it away and a scores off it (t 25), then
// a settled make, a late miss, and the winner, which is left out of shooting rates.
const events = [
  shot("1", "a", 0, false, { rebounderId: "a" }),
  shot("2", "a", 4, true),
  shot("3", "b", 20, true, { contestLevel: "heavy", defenderIds: ["a"] }),
  shot("4", "a", 26, true),
  shot("5", "a", 40, true),
  shot("6", "b", 50, false, { rebounderId: "a" }),
  shot("7", "b", 58, false, { rebounderId: null }),
  shot("8", "a", 60, true, { shotType: null }),
  shot("9", "a", 70, false, { rebounderId: "b" }),
  shot("10", "b", 80, false, { rebounderId: "a" }),
  shot("11", "a", 90, false, { rebounderId: "b" }),
  shot("12", "a", 100, true),
]
const game: Game = {
  id: "g",
  date: "2026-08-01",
  teamA: ["a"],
  teamB: ["b"],
  winner: "A",
  stats: [
    { playerId: "a", pts: 10, oreb: 1, dreb: 3, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 },
    { playerId: "b", pts: 2, oreb: 0, dreb: 2, ast: 0, stl: 0, blk: 0, tov: 1, pf: 0 },
  ],
  scoringEvents: events,
  turnoverEvents: [{ id: "t", playerId: "b", videoTime: 24 }],
  stealEvents: [],
  foulEvents: [],
}
const state: PooleanState = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [game], playerPhysicalOverrides: { a: { heightIn: 74 }, b: { heightIn: 68 } } }
const oldGame = (n: number, date: string, a: string[], b: string[], w: "A" | "B") => ({ n, date, a, b, w })

describe("trust", () => {
  it("grades by how much is behind a number", () => {
    expect(trustOf(9, "shots")).toBe("early")
    expect(trustOf(50, "shots")).toBe("some")
    expect(trustOf(100, "shots")).toBe("steady")
  })
  it("pulls small samples to the league and keeps ranges in bounds", () => {
    expect(shrink(0, 0, 0.8)).toBe(0.8)
    expect(wilson(0, 10)[0]).toBe(0)
    expect(wilson(5, 10)[0]).toBeLessThan(0.5)
  })
})

describe("win impact", () => {
  const rows: Result[] = [
    ...Array.from({ length: 6 }, (_, i) => ({ a: ["x", "p"], b: ["y", "q"], aWon: true, night: `n${i}` })),
    ...Array.from({ length: 2 }, (_, i) => ({ a: ["x", "q"], b: ["y", "p"], aWon: true, night: `m${i}` })),
  ]
  it("credits the player who keeps winning, whichever side was typed in as A", () => {
    const f = fit(rows)
    const swapped = fit(rows.map((r) => ({ ...r, a: r.b, b: r.a, aWon: !r.aWon })))
    expect(f.w.get("x")!).toBeGreaterThan(f.w.get("p")!)
    expect(swapped.w.get("x")!).toBeCloseTo(f.w.get("x")!, 6)
  })
  it("does not count a game twice when both sites have it", () => {
    const old = [oldGame(1, "2026-08-01", ["b"], ["a"], "B"), oldGame(2, "2026-08-02", ["a"], ["b"], "A")]
    expect(results(state, old)).toHaveLength(2)
  })
  it("adds app games the old site does not have", () => {
    expect(results(state, [oldGame(1, "2026-07-01", ["a"], ["b"], "A")])).toHaveLength(2)
  })
  it("reports a range around each player", () => {
    const old = Array.from({ length: 6 }, (_, i) => oldGame(i, `2026-07-0${i + 1}`, ["a"], ["b"], "A"))
    const w = winImpact(state, old)
    const a = w.rows.find((r) => r.id === "a")!
    expect(a.impact).toBeGreaterThan(0)
    expect(a.lo).toBeLessThanOrEqual(a.hi)
  })
  it("splits by team size and game number", () => {
    const s = splits(state, [])
    const a = s.find((r) => r.id === "a")!
    expect(a.size.Other.w).toBe(1)
    expect(a.night[0].shots.att).toBe(8)
  })
})

describe("sequences", () => {
  const s = sequences(state)
  const a = s.rows.find((r) => r.id === "a")!
  it("finds putbacks and shots off turnovers", () => {
    expect(a.putback).toEqual({ made: 1, att: 1 })
    expect(a.offTurnover).toEqual({ made: 1, att: 1 })
  })
  it("counts the next shot after the other team scored", () => {
    expect(a.answer).toEqual({ made: 1, att: 1 })
  })
  it("leaves out the basket that ended the game", () => {
    expect(a.all.att).toBe(7)
  })
})

describe("identity", () => {
  const r = playerIdentity(state)
  it("measures getting open and attention", () => {
    const b = r.rows.find((x) => x.id === "b")!
    expect(b.open).toBe(3 / 4)
    expect(b.defenders).toBe(1 / 4)
  })
  it("counts a beaten defender as wide open, and counts it on both players", () => {
    const beat: PooleanState = { ...state, games: [{ ...game, scoringEvents: [...events, shot("bt", "b", 3, true, { contestLevel: "beat", defenderIds: ["a"] })] }] }
    const rows = playerIdentity(beat).rows
    expect(rows.find((x) => x.id === "b")!.openOffBeat).toBe(1)
    expect(rows.find((x) => x.id === "a")!.gotBeat).toBe(1)
    const before = playerIdentity({ ...state, games: [{ ...game, scoringEvents: [...events, shot("bt", "b", 3, true, { contestLevel: "heavy", defenderIds: ["a"] })] }] }).rows.find((x) => x.id === "b")!.open
    expect(rows.find((x) => x.id === "b")!.open).toBeGreaterThan(before)
  })
  it("pulls a zone toward the league", () => {
    const b = r.rows.find((x) => x.id === "b")!
    expect(b.zones.close.att).toBe(4)
    expect(b.zones.close.vsLeague).not.toBeNull()
  })
})

describe("body and effort", () => {
  it("says too early below the minimum players", () => {
    expect(correlate([1, 2], [1, 2]).sure).toBe("early")
  })
  it("finds a perfect link when there are enough players", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(correlate(x, x).rho).toBeCloseTo(1, 6)
    expect(correlate(x, x).sure).toBe("clear")
  })
  it("buckets guarded shots by height", () => {
    const b = bodyEffort(state, { rows: [], check: { model: 0, baseline: 0, games: 0 }, nights: 0 })
    expect(b.league.shooterShorter).toEqual({ made: 1, att: 1 })
  })
})

describe("got beat and stops", () => {
  const g: Game = { ...game, scoringEvents: [shot("m1", "a", 1, false, { defenderIds: ["b"], contestLevel: "heavy" }), shot("m2", "a", 2, false, { defenderIds: ["b"], contestLevel: "beat" }), shot("k1", "a", 3, true, { defenderIds: ["b"], contestLevel: "beat" })] }
  const d = gameDefenseStats(g, "b")
  it("gives no stop for a missed shot off a beaten defender", () => {
    expect(d.stops).toBe(2)
    expect(d.beatMisses).toBe(1)
    expect(defensiveRating(getGameStats(g, "b"), d) - defensiveRating(getGameStats(g, "b"), { ...d, beatMisses: 0 })).toBe(-1)
  })
  it("keeps every miss in Opp FG%, and the made shot still counts against them", () => {
    expect(d.timesBeaten).toBe(1)
    expect(d.timesBeaten / (d.timesBeaten + d.stops)).toBeCloseTo(1 / 3, 6)
  })
})

describe("blanks", () => {
  it("lists only what should have been tagged", () => {
    const k = findBlanks(state).map((b) => `${b.key}`)
    expect(k).toContain("8-shotType")
    expect(k).toContain("7-rebounder")
    // a free throw and a dunk need no shot type, and a free throw needs no spot
    const odd = findBlanks({ ...state, games: [{ ...game, scoringEvents: [shot("ft", "a", 1, true, { points: 1, shotType: null, shotLocation: null }), shot("dk", "a", 2, true, { shotType: null, dunk: true }), shot("bk", "a", 3, false, { blockerId: "b" })] }] })
    expect(odd).toEqual([])
    expect(k).not.toContain("t-forcedBy")
    expect(k).toHaveLength(2)
  })
})
