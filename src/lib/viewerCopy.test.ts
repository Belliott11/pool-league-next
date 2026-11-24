import { beforeEach, expect, test, vi } from "vitest"
import type { PooleanState } from "@/lib/types"

let store: Map<string, string>
beforeEach(() => {
  store = new Map()
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
})

const state = (live: boolean) => ({ players: [{ id: "a", name: "A" }], games: [{ id: "g1", liveInProgress: false }, ...(live ? [{ id: "g2", liveInProgress: true }] : [])] }) as unknown as PooleanState

test("the saved copy round-trips, is kept apart from the editor's copy, and survives bad storage", async () => {
  const v = await import("@/lib/viewerCopy")
  expect(v.loadViewerCopy()).toBeNull()
  v.saveViewerCopy({ state: state(false), updatedAt: "2026-11-24T10:00:00Z" })
  expect(v.loadViewerCopy()?.remote.updatedAt).toBe("2026-11-24T10:00:00Z")
  expect([...store.keys()]).toEqual(["pooleanIntelViewerCopy"])
  store.set("pooleanIntelViewerCopy", "{not json")
  expect(v.loadViewerCopy()).toBeNull()
})

test("a game the saved copy shows as live is left out, never shown as happening now", async () => {
  const v = await import("@/lib/viewerCopy")
  expect(v.withoutLiveGames(state(true)).games.map((g) => g.id)).toEqual(["g1"])
  const plain = state(false)
  expect(v.withoutLiveGames(plain)).toBe(plain)
})
