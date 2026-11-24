import { describe, expect, it, vi } from "vitest"

// The odds maths is what is under test; the pre-game model, stats and store are not needed.
vi.mock("@/lib/matchup", () => ({ predictRealMatchup: () => null }))
vi.mock("@/lib/stats", () => ({ liveScoreOf: () => 0 }))
vi.mock("@/lib/store", () => ({ newGame: () => ({}) }))

import { PREGAME_WEIGHT_LIVE, winProbabilityFrom as p } from "@/lib/live"

describe("winProbabilityFrom (race to the target)", () => {
  it("starts from the pre-game read's lean, scaled by PREGAME_WEIGHT_LIVE", () => {
    expect(p(0, 0, 21, null)).toBeCloseTo(0.5, 2)
    expect(p(0, 0, 21, 0.7)).toBeCloseTo(0.5 + PREGAME_WEIGHT_LIVE * 0.2, 2)
    expect(p(0, 0, 21, 0.3)).toBeCloseTo(1 - p(0, 0, 21, 0.7), 6) // either side, the same pull
  })

  it("favors whoever leads, and the opposite side is the mirror image", () => {
    expect(p(10, 6, 21, 0.5)).toBeGreaterThan(0.5)
    expect(p(6, 10, 21, 0.5)).toBeLessThan(0.5)
    expect(p(12, 7, 21, 0.5, 6, 3) + p(7, 12, 21, 0.5, 3, 6)).toBeCloseTo(1, 3)
  })

  it("is decided at the target and never reaches 0 or 1 before it", () => {
    expect(p(21, 15, 21, 0.5)).toBe(0.99)
    expect(p(15, 21, 21, 0.5)).toBe(0.01)
    expect(p(20, 3, 21, 0.5)).toBeLessThanOrEqual(0.99)
    expect(p(3, 20, 21, 0.5)).toBeGreaterThanOrEqual(0.01)
  })

  it("trusts the same lead more the closer the game is to ending", () => {
    expect(p(18, 14, 21, 0.5)).toBeGreaterThan(p(8, 4, 21, 0.5))
  })

  it("learns from how a team has been scoring", () => {
    // Same score, but A got there with far more baskets than B.
    expect(p(8, 8, 21, 0.5, 6, 3)).toBeGreaterThan(p(8, 8, 21, 0.5, 3, 6))
  })
})
