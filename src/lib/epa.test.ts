import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState, ScoringEvent, TurnoverEvent } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { pointsAdded, leagueValues, shotEnd } = await import("@/lib/epa")
const { CREDIT } = await import("@/lib/insight")

let n = 0
const shot = (scorerId: string, points: 2 | 3, made: boolean, more: Partial<ScoringEvent> = {}): ScoringEvent => ({ id: `s${n++}`, scorerId, points, made, ...more }) as ScoringEvent
const game = (scoringEvents: ScoringEvent[], turnoverEvents: TurnoverEvent[] = []): Game =>
  ({ id: `g${n++}`, date: "2026-08-01", teamA: ["a1", "a2"], teamB: ["b1", "b2"], scoringEvents, turnoverEvents, stats: [] }) as unknown as Game

describe("points added", () => {
  const miss3 = shot("a1", 3, false, { rebounderId: "a2" })
  const out3 = shot("a1", 3, false)
  const g = game(
    [miss3, shot("a2", 2, true, { assistId: "a1" }), shot("b1", 2, true), out3, shot("b2", 2, false, { rebounderId: "a1" }), shot("b1", 3, true), shot("a2", 2, true)],
    [{ id: "t1", playerId: "a1", missEventId: out3.id } as TurnoverEvent, { id: "t2", playerId: "b2", opponentId: "a2" } as TurnoverEvent],
  )
  const state = { games: [g], players: [] } as unknown as PooleanState
  const v = leagueValues([g])
  it("counts trips and points per trip", () => {
    // 7 shots, 1 kept by an offensive rebound, plus 1 live-ball turnover: 7 trips, 9 points.
    expect(v.trips).toBe(7)
    expect(v.ep).toBeCloseTo(9 / 7, 10)
    const out = new Set([out3.id])
    expect(shotEnd(g, out3, out)).toBe("out")
    expect(shotEnd(g, miss3, out)).toBe("kept")
  })
  it("credits shots, rebounds, passes and turnovers", () => {
    const e = pointsAdded(state)
    const row = (id: string) => e.rows.find((r) => r.id === id)!
    const ep = v.ep
    // a1: an in-bounds missed 3, an out-of-bounds missed 3, an assist, a defensive rebound.
    expect(row("a1").parts.shots).toBeCloseTo(v.keep3 * ep - ep + (0 - ep), 10)
    expect(row("a1").parts.passes).toBeCloseTo((2 - ep) * CREDIT.assister, 10)
    expect(row("a1").parts.defense).toBeCloseTo(v.keep2 * ep, 10)
    // a2: the offensive rebound, an assisted 2, an unassisted 2, a forced turnover.
    expect(row("a2").parts.boards).toBeCloseTo((1 - v.keep3) * ep, 10)
    expect(row("a2").parts.shots).toBeCloseTo((2 - ep) * CREDIT.scorer + (2 - ep), 10)
    expect(row("a2").parts.defense).toBeCloseTo(ep, 10)
    expect(row("b2").parts.turnovers).toBeCloseTo(-ep, 10)
  })
})

it.skipIf(!existsSync("public/test-data.json"))("adds up to zero over the league, apart from rebounds nobody is credited with", async () => {
  const state = JSON.parse(readFileSync("public/test-data.json", "utf8")) as PooleanState
  ;(await import("@/lib/per")).setPaceGames(state.games)
  const e = pointsAdded(state)
  const offense = e.rows.reduce((s, r) => s + r.parts.shots + r.parts.passes + r.parts.turnovers + r.parts.boards, 0)
  // Every trip's plays add up to its points less ep, so the offense's total is zero once the rebounds that go to nobody
  // (in-bounds misses the defense ends, -keep x ep each; blocks out off the defense, +(1 - keep) x ep) are put back.
  const { games } = await import("@/lib/insight")
  const v = e.values
  let unassigned = 0
  for (const g of games(state)) {
    const out = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean) as string[])
    for (const s of g.scoringEvents) {
      if (s.points === 1) continue
      const end = shotEnd(g, s, out)
      const keep = s.points === 2 ? v.keep2 : v.keep3
      if (end === "lost") unassigned -= keep * v.ep
      if (end === "kept" && !(s.rebounderId && (g.teamA.includes(s.rebounderId) === g.teamA.includes(s.scorerId)))) unassigned += (1 - keep) * v.ep
    }
  }
  expect(offense + unassigned).toBeCloseTo(0, 6)
})
