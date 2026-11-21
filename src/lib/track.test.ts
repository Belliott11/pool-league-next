import { expect, it } from "vitest"
import { atTime, findPatch, patchAt, smooth, type Img } from "@/lib/track"

// A 100x60 blue picture with a small white square (the "ball") at (cx, cy).
const frame = (cx: number, cy: number): Img => {
  const w = 100, h = 60, data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const ball = Math.abs(x - cx) <= 3 && Math.abs(y - cy) <= 3
    data.set(ball ? [250, 250, 250, 255] : [30, 120, 200, 255], i)
  }
  return { data, w, h }
}

it("finds a moved target near where it was", () => {
  const tpl = patchAt(frame(30, 30), 30, 30)
  const hit = findPatch(frame(44, 36), tpl, 30, 30, 30)
  expect(Math.abs(hit.x - 44)).toBeLessThanOrEqual(1)
  expect(Math.abs(hit.y - 36)).toBeLessThanOrEqual(1)
  expect(hit.miss).toBeLessThan(10)
})

it("reports a big miss when the target is not there", () => {
  const tpl = patchAt(frame(30, 30), 30, 30)
  expect(findPatch(frame(-50, -50), tpl, 30, 30, 20).miss).toBeGreaterThan(40)
})

it("walks the path in straight lines and holds at the ends", () => {
  const t = [{ t: 10, x: 0.2, y: 0.4 }, { t: 12, x: 0.6, y: 0.8 }]
  expect(atTime(t, 5)).toMatchObject({ x: 0.2, y: 0.4 })
  const mid = atTime(t, 11)!
  expect(mid.x).toBeCloseTo(0.4)
  expect(mid.y).toBeCloseTo(0.6)
  expect(atTime(t, 20)).toMatchObject({ x: 0.6, y: 0.8 })
  expect(atTime([], 1)).toBeNull()
})

it("smooths a jumpy path", () => {
  const s = smooth([{ t: 0, x: 0.5, y: 0.5 }, { t: 1, x: 0.9, y: 0.5 }, { t: 2, x: 0.5, y: 0.5 }])
  expect(s[1].x).toBeLessThan(0.9)
})
