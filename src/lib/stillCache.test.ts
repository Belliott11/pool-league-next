import { afterEach, describe, expect, it, test, vi } from "vitest"
import { frameStyle, readStill, stillKey, waterFrame, writeStill } from "@/lib/stillCache"

const store = new Map<string, string>()
vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
afterEach(() => store.clear())

test("a still is keyed by recording and moment, and the oldest go when too many are kept", () => {
  expect(stillKey("https://h.dev/videos/abc/file.mp4?sig=1#t=5", 12.4)).toBe(stillKey("https://h.dev/videos/abc/file.mp4", 12))
  for (let i = 0; i < 45; i++) writeStill(`k${i}`, `d${i}`)
  expect(readStill("k0")).toBeNull() // dropped
  expect(readStill("k4")).toBeNull()
  expect(readStill("k5")).toBe("d5")
  expect(readStill("k44")).toBe("d44")
  writeStill("k44", "again") // rewriting moves it to newest, not a duplicate
  expect(readStill("k44")).toBe("again")
})

test("storage that throws is skipped quietly", () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked") }, setItem: () => { throw new Error("blocked") }, removeItem: () => {} })
  expect(readStill("x")).toBeNull()
  expect(() => writeStill("x", "y")).not.toThrow()
})



describe("auto framing", () => {
  // 100x56 picture: grey everywhere except a blue pool filling x 20..60, y 10..40
  const pic = (water: boolean) => {
    const w = 100, h = 56
    const px = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inPool = water && x >= 20 && x < 60 && y >= 10 && y < 40
      px.set(inPool ? [30, 120, 200, 255] : [90, 90, 90, 255], i)
    }
    return { px, w, h }
  }
  it("centers on the pool and zooms in", () => {
    const { px, w, h } = pic(true)
    const f = waterFrame(px, w, h)!
    expect(f.x).toBeCloseTo(0.4, 1)
    expect(f.y).toBeCloseTo(0.45, 1)
    expect(f.z).toBeGreaterThan(1.3)
  })
  it("leaves a picture with no pool alone", () => {
    const { px, w, h } = pic(false)
    expect(waterFrame(px, w, h)).toBeNull()
    expect(frameStyle(null)).toBeUndefined()
  })
})
