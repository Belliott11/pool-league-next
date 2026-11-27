import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })

describe("night report", () => {
  it("grades by the share of player-nights beaten, A+ to D", async () => {
    const { gradeFor } = await import("@/lib/nightReport")
    expect(gradeFor(0.95)).toBe("A+")
    expect(gradeFor(0.5)).toBe("B")
    expect(gradeFor(0)).toBe("D")
  })

  it("reports the last night: record, points, best play and one to fix", async () => {
    const { setFilters } = await import("@/lib/filters")
    setFilters({ imbalanced: true })
    const { nightReport } = await import("@/lib/nightReport")
    const shot = (id: string, scorerId: string, made: boolean, t: number, d: string) => ({ id, scorerId, points: 2 as const, made, videoTime: t, shotType: "drive", contestLevel: "medium", defenderIds: [d] })
    const game = (id: string, date: string, aMakes: boolean): Game =>
      ({
        id, date, liveTarget: 50, teamA: ["a"], teamB: ["b"], stats: [], turnoverEvents: [], stealEvents: [], foulEvents: [],
        scoringEvents: [shot(`${id}1`, "a", aMakes, 1, "b"), shot(`${id}2`, "a", true, 2, "b"), shot(`${id}3`, "b", false, 3, "a"), shot(`${id}4`, "a", !aMakes, 4, "b")],
      }) as unknown as Game
    const state = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [game("g1", "2026-07-01", true), game("g2", "2026-07-08", false)] } as unknown as PooleanState
    const r = nightReport(state, "a")!
    expect(r.date).toBe("2026-07-08")
    expect(r.wins).toBe(1)
    expect(r.points).toBe(4)
    expect(r.best?.made).toBe(true)
    expect(r.fix?.made).toBe(false)
    expect(nightReport(state, "nobody")).toBeNull()
    expect(r.grade).not.toBeNull() // a second night is graded against the first
    const first = { ...state, games: state.games.slice(0, 1) } as PooleanState
    expect(nightReport(first, "a")!.grade).toBeNull() // a first night has no usual level to compare with
  })

  it("grades only against the player's own level", async () => {
    const { normalCdf } = await import("@/lib/nightReport")
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.2816)).toBeCloseTo(0.9, 3)
  })
})
