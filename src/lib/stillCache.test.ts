import { afterEach, describe, expect, it, test, vi } from "vitest"
import { coverStyle, frameStyle, readStill, stillKey, waterFrame, writeStill } from "@/lib/stillCache"

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

describe("cover crop", () => {
  // Where a point of the picture ends up in the box after the crop: (box centre) + pan + zoom * (its place laid out - centre).
  const place = (W: number, H: number, x: number, y: number, z: number) => {
    const st = coverStyle({ z, x, y }, W, H)!
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(st.transform)!
    const s0 = Math.max(W / 1280, H / 720), Wd = 1280 * s0, Hd = 720 * s0
    return { px: W / 2 + Number(m[1]) + z * (( W - Wd) / 2 + x * Wd - W / 2), py: H / 2 + Number(m[2]) + z * ((H - Hd) / 2 + y * Hd - H / 2) }
  }
  it("keeps every point of the picture on screen in a tall phone box, at any zoom", () => {
    for (const z of [1.1, 1.5, 2, 2.5]) for (const x of [0, 0.1, 0.5, 0.9, 1]) for (const y of [0, 0.5, 1]) {
      const { px, py } = place(390, 700, x, y, z)
      expect(px).toBeGreaterThanOrEqual(-0.6)
      expect(px).toBeLessThanOrEqual(390.6)
      expect(py).toBeGreaterThanOrEqual(-0.6)
      expect(py).toBeLessThanOrEqual(700.6)
    }
  })
  it("centres a point that can be centred, and does nothing at no zoom", () => {
    const { px } = place(390, 700, 0.5, 0.5, 2)
    expect(px).toBeCloseTo(195, 0)
    expect(coverStyle({ z: 1, x: 0.2, y: 0.2 }, 390, 700)).toBeUndefined()
  })
})
