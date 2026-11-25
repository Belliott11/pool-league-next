import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { breakEvenThree, leagueShooter, playerShooter, possessionOdds, shotKinds, shotValue, type Shooter } from "@/lib/shotChoice"
import type { PooleanState } from "@/lib/types"

const L: Shooter = { p2: 0.4, p3: 0.17, keep2: 0.25, keep3: 0.12, oob2: 0.21, oob3: 0.44 }

describe("is a 3 worth it", () => {
  const W = possessionOdds(16, 0.22, 0.05)
  it("treats both teams alike", () => {
    for (const [a, b] of [[0, 0], [8, 10], [15, 15], [14, 12]]) expect(W(a, b, true) + W(b, a, false)).toBeCloseTo(1, 8)
    expect(W(0, 0, true)).toBeGreaterThan(0.5) // having the ball first is worth a little
  })
  it("knows the end of a game", () => {
    expect(W(16, 10, false)).toBe(1)
    expect(W(16, 15, true)).toBeLessThan(1) // win by 2: not over yet
    expect(W(17, 17, true)).toBeCloseTo(W(15, 15, true), 8) // past the target, only the margin matters
  })
  it("makes a 3 worth the same as a 2 when only the margin matters", () => {
    expect(breakEvenThree(W, 15, 15, { ...L, keep3: L.keep2 })).toBeCloseTo(L.p2, 6)
  })
  it("asks more of a 3 when its misses are lost more often", () => {
    expect(breakEvenThree(W, 8, 8, L)!).toBeGreaterThan(breakEvenThree(W, 8, 8, { ...L, keep3: L.keep2 })!)
    expect(breakEvenThree(W, 8, 8, L)!).toBeGreaterThan(L.p3)
  })
  it("matches the two shots' values at the break-even rate", () => {
    const p = breakEvenThree(W, 11, 14, L)!
    expect(shotValue(W, 11, 14, 3, p, L.keep3)).toBeCloseTo(shotValue(W, 11, 14, 2, L.p2, L.keep2), 8)
  })
})

it.skipIf(!existsSync("public/test-data.json"))("reads misses out of bounds from the live league data", () => {
  const state = JSON.parse(readFileSync("public/test-data.json", "utf8")) as PooleanState
  const { two, three } = shotKinds(state)
  expect(two.made + two.oob + two.oreb + two.lost).toBe(two.att)
  expect(three.oob).toBeGreaterThan(0)
  const league = leagueShooter(state)
  for (const p of state.players) {
    const s = playerShooter(state, p.id, league)
    expect(s.keep3).toBeLessThanOrEqual(1 - s.oob3 + 1e-9)
  }
})
