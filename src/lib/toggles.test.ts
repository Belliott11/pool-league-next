import { afterEach, beforeEach, expect, test, vi } from "vitest"

let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.resetModules()
})
afterEach(() => vi.unstubAllGlobals())

test("outliers count by default until 20 filmed games, then are left out by default", async () => {
  const f = await import("@/lib/filters")
  const t = await import("@/lib/toggles")
  f.setFilmedGames(10)
  expect(t.loadToggles().outliers).toBe(true)
  expect(f.isDefaultFilters({ imbalanced: false, outliers: true })).toBe(true)
  f.setFilmedGames(20)
  expect(t.loadToggles().outliers).toBe(false)
  expect(f.isDefaultFilters({ imbalanced: false, outliers: false })).toBe(true)
  expect(f.isDefaultFilters({ imbalanced: false, outliers: true })).toBe(false)
})

test("a choice in the Filters menu sticks when the default moves; choosing the default goes back to automatic", async () => {
  const f = await import("@/lib/filters")
  const t = await import("@/lib/toggles")
  f.setFilmedGames(10)
  t.storeToggles({ imbalanced: false, pastSeasons: false, outliers: false }) // chose to leave them out early
  f.setFilmedGames(25)
  expect(t.loadToggles().outliers).toBe(false)
  t.storeToggles({ imbalanced: false, pastSeasons: false, outliers: true }) // chose to keep them after the switch
  expect(t.loadToggles().outliers).toBe(true)
  t.storeToggles({ imbalanced: true, pastSeasons: false, outliers: false }) // back to the default for outliers
  expect(JSON.parse(store.get("pooleanIntelToggles")!).outliers).toBeUndefined()
})

test("settings saved before the default could move: outliers on (the old default) becomes automatic, off is kept", async () => {
  const f = await import("@/lib/filters")
  const t = await import("@/lib/toggles")
  f.setFilmedGames(30)
  store.set("pooleanIntelToggles", JSON.stringify({ imbalanced: true, pastSeasons: false, outliers: true }))
  expect(t.loadToggles()).toEqual({ imbalanced: true, pastSeasons: false, outliers: false })
  store.set("pooleanIntelToggles", JSON.stringify({ imbalanced: false, pastSeasons: false, outliers: false }))
  f.setFilmedGames(5)
  expect(t.loadToggles().outliers).toBe(false)
})
