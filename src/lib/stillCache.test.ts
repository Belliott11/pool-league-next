import { afterEach, expect, test, vi } from "vitest"
import { readStill, stillKey, writeStill } from "@/lib/stillCache"

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
