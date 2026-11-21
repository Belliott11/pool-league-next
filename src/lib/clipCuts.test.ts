import { describe, expect, it } from "vitest"
import { clipSource, cutKey, cutWindow } from "@/lib/clipCuts"

describe("clip cuts", () => {
  it("cuts from 5 seconds before to 6 after, or the editor's trim", () => {
    expect(cutWindow({ time: 100 })).toEqual({ start: 95, end: 106 })
    expect(cutWindow({ time: 2, to: 9 })).toEqual({ start: 0, end: 9 })
    expect(cutWindow({ time: 1560, from: 1557.87537, to: 1563.87537 })).toEqual({ start: 1557.88, end: 1563.88 })
  })
  it("keys a cut by the recording's file name and stretch", () => {
    expect(cutKey("https://x.r2.dev/videos/g1/rec.mp4#t=4", { start: 95, end: 106 })).toBe("rec.mp4|95|106")
  })
  it("plays the full recording when there is no cut", () => {
    expect(clipSource("https://x.r2.dev/videos/g1/none.mp4", { time: 100 })).toEqual({ src: "https://x.r2.dev/videos/g1/none.mp4", offset: 0, cut: false })
  })
})
