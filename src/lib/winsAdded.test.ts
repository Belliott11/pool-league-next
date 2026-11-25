import { describe, expect, it } from "vitest"
import { winChanceWith, winsAdded } from "@/lib/winsAdded"
import type { EpaRow } from "@/lib/epa"

describe("wins added", () => {
  it("is zero for an average player and grows with points added", () => {
    expect(winChanceWith(0, 16)).toBeCloseTo(0.5, 6)
    expect(winChanceWith(2, 16)).toBeGreaterThan(0.5)
    expect(winChanceWith(4, 16)).toBeGreaterThan(winChanceWith(2, 16))
    expect(winChanceWith(-2, 16)).toBeCloseTo(1 - winChanceWith(2, 16), 6)
  })
  it("counts a longer game as worth more for the same edge per game", () => {
    expect(winChanceWith(2, 21)).toBeGreaterThan(winChanceWith(2, 11))
  })
  it("adds up over the games played", () => {
    const row = (id: string, perGame: number, gamesWorth: number) => ({ id, perGame, gamesWorth, games: 5 }) as unknown as EpaRow
    const [a, b] = winsAdded([row("b", 1, 4), row("a", 3, 4)], 16)
    expect(a.id).toBe("a")
    expect(a.total).toBeCloseTo((winChanceWith(3, 16) - 0.5) * 4, 10)
    expect(b.total).toBeGreaterThan(0)
  })
})
