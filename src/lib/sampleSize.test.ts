import { describe, expect, it } from "vitest"
import { SAMPLE_MIN, facedSample, fgaSample, gamesSample, isLowSample, shotSample } from "@/lib/sampleSize"

describe("sample size labels", () => {
  it("uses 15 shots, 5 shots faced and 4 games as the lines", () => {
    expect(SAMPLE_MIN).toEqual({ shots: 15, faced: 5, games: 4 })
    expect(isLowSample(shotSample(5, 14))).toBe(true)
    expect(isLowSample(shotSample(5, 15))).toBe(false)
    expect(isLowSample(facedSample(1, 4))).toBe(true)
    expect(isLowSample(facedSample(1, 5))).toBe(false)
    expect(isLowSample(gamesSample(3))).toBe(true)
    expect(isLowSample(gamesSample(4))).toBe(false)
  })
  it("words the count to print next to a value", () => {
    expect(shotSample(5, 15).count).toBe("5/15")
    expect(fgaSample(15).count).toBe("15 FGA")
    expect(gamesSample(6).count).toBe("6 GP")
  })
})
