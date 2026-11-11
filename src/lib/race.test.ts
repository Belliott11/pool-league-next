import { describe, expect, it } from "vitest"
import { gameOver, raceLine, raceWin } from "@/lib/race"

const twos: [number, number][] = [[2, 1]]
const ones: [number, number][] = [[1, 1]]

describe("win by 2", () => {
  it("only ends the game with a 2-point lead at or past the target", () => {
    expect(gameOver(16, 14, 16)).toBe(true)
    expect(gameOver(16, 15, 16)).toBe(false)
    expect(gameOver(18, 17, 16)).toBe(false)
    expect(gameOver(19, 17, 16)).toBe(true)
    expect(gameOver(15, 10, 16)).toBe(false)
  })
  it("gives a fair race even odds, and a lead at the target is not yet a win", () => {
    expect(raceWin(0, 0, 16, 0.5, twos)).toBeCloseTo(0.5)
    expect(raceWin(15, 15, 16, 0.5, ones)).toBeCloseTo(0.5)
    // Up one at the target with ones only: win the next point (half) or go back to deuce (half of a half).
    expect(raceWin(16, 15, 16, 0.5, ones)).toBeCloseTo(0.75)
    expect(raceWin(14, 2, 16, 0.5, twos)).toBeGreaterThan(0.99)
  })
  it("words the scoreboard line", () => {
    expect(raceLine(16, 15, 16)).toBe("Team A leads by 1 at 16. Win by 2.")
    expect(raceLine(15, 15, 16)).toBe("Tied at 15. Win by 2.")
    expect(raceLine(17, 15, 16)).toBe("Team A won, 17 to 15.")
    expect(raceLine(10, 12, 16)).toBe("Team B leads by 2. 4 to go.")
  })
})
