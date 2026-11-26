import { describe, expect, it } from "vitest"
import { clipCutKey, clipSource, cutKey, cutPath, cutWindow } from "@/lib/clipCuts"

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
    expect(clipSource("https://x.r2.dev/videos/g1/none.mp4", { time: 100 })).toEqual({ src: "https://x.r2.dev/videos/g1/none.mp4", offset: 0, cut: false, followed: false })
  })
  it("gives a followed clip its own key, which changes with the path or the zoom, and a path in cut time", () => {
    const track = [{ t: 100, x: 0.2, y: 0.5 }, { t: 102, x: 0.6, y: 0.5 }]
    const k = clipCutKey("https://x/r.mp4", { time: 100, track, frame: { z: 2 } })
    expect(k).toMatch(/^r\.mp4\|95\|106\|f[0-9a-z]+$/)
    expect(clipCutKey("https://x/r.mp4", { time: 100, track, frame: { z: 1.6 } })).not.toBe(k)
    expect(clipCutKey("https://x/r.mp4", { time: 100, track: [track[0], { t: 102, x: 0.7, y: 0.5 }], frame: { z: 2 } })).not.toBe(k)
    expect(clipCutKey("https://x/r.mp4", { time: 100 })).toBe("r.mp4|95|106")
    const p = cutPath({ time: 100, track, frame: { z: 2 } })!
    expect(p.zoom).toBe(2)
    // The cut starts at 95, before the path: held at its first point, smoothed as the browser camera is (two points smooth to their average).
    expect(p.path[0]).toEqual({ t: 0, x: 0.4, y: 0.5 })
    expect(p.path.at(-1)!.t).toBe(11)
  })
})
