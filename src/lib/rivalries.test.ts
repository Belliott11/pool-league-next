import { describe, expect, it } from "vitest"
import { attendance, turnout } from "@/lib/attendance"
import { rivalries } from "@/lib/rivalries"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const game = (id: string, date: string, xPts: number, yPts: number): Game => ({ ...base, id, date, teamA: ["x"], teamB: ["y"], liveScores: [{ pid: "x", points: xPts }, { pid: "y", points: yPts }] })
const state = (games: Game[]): PooleanState => ({ players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }, { id: "z", name: "Z" }], games })

describe("rivalries", () => {
  it("needs 4 meetings, names the leader and the current streak", () => {
    const g = [game("1", "2026-10-01", 5, 3), game("2", "2026-10-08", 3, 5), game("3", "2026-10-15", 3, 5), game("4", "2026-10-22", 3, 5)]
    expect(rivalries(state(g.slice(0, 3)))).toEqual([])
    const r = rivalries(state(g))[0]
    expect(r).toMatchObject({ a: "y", b: "x", aWins: 3, bWins: 1, streakBy: "y", streak: 3 })
  })
})

describe("attendance", () => {
  it("counts nights played and flags regulars who are not on the list", () => {
    const g = [1, 2, 3, 4].map((n) => game(String(n), `2026-10-0${n}`, 5, 3))
    const a = attendance(state(g))
    expect(a.total).toBe(4)
    expect(a.rows.find((r) => r.id === "x")).toMatchObject({ nights: 4, pct: 100, recent: 4 })
    expect(a.rows.find((r) => r.id === "z")).toBeUndefined()
    expect(turnout(state(g), ["x"]).missing).toEqual(["y"])
    expect(turnout(state(g), ["x", "y"]).teams).toBe("Even teams: 1 v 1")
  })
})
