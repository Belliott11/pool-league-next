import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const g = (id: string, master: string, start: number, extra: Partial<Game> = {}): Game =>
  ({ id, date: "2026-08-10", teamA: ["a"], teamB: ["b"], stats: [], turnoverEvents: [], stealEvents: [], foulEvents: [], scoringEvents: [], masterVideoId: master, videoStart: start, ...extra }) as unknown as Game

describe("do players tire", () => {
  it("orders a night by recording part, then where each game starts in it", async () => {
    const { nightOrder } = await import("@/lib/fatigue")
    const state = {
      players: [],
      masterVideos: [{ id: "m2", name: "Aug 10 games pt. 2" }, { id: "m1", name: "Aug 10 games pt 1" }],
      games: [g("late", "m2", 100), g("second", "m1", 900), g("first", "m1", 50)],
    } as unknown as PooleanState
    expect(nightOrder(state, "2026-08-10").map((x) => x.id)).toEqual(["first", "second", "late"])
  })

  it("prefers the live start time when every game has one", async () => {
    const { nightOrder } = await import("@/lib/fatigue")
    const state = { players: [], games: [g("b", "", 0, { startedAt: "2026-08-10T21:00:00Z" }), g("a", "", 500, { startedAt: "2026-08-10T20:00:00Z" })] } as unknown as PooleanState
    expect(nightOrder(state, "2026-08-10").map((x) => x.id)).toEqual(["a", "b"])
  })
})
