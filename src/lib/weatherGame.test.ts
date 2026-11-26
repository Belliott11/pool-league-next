import { describe, expect, it } from "vitest"
import { MIN_NIGHTS, weatherGame, weatherOf } from "./weatherGame"
import type { Game, PooleanState } from "./types"

const shots = (id: string, pid: string, made: number, missed: number) => [
  ...Array.from({ length: made }, (_, i) => ({ id: `${id}m${i}`, scorerId: pid, points: 2, made: true })),
  ...Array.from({ length: missed }, (_, i) => ({ id: `${id}x${i}`, scorerId: pid, points: 2, made: false })),
]
const game = (id: string, date: string, made: number, missed: number): Game =>
  ({ id, date, teamA: ["p", "q"], teamB: ["x", "y"], winner: "A", stats: [], scoringEvents: shots(id, "p", made, missed), turnoverEvents: [], stealEvents: [], foulEvents: [] }) as unknown as Game
const night = (t: number, cloud = 10) => ({ source: "archive", hours: Object.fromEntries([17, 18, 19, 20, 21].map((h) => [String(h), { t, feels: t, rh: 50, cloud, wind: 5, code: 0 }])) })

describe("weatherGame", () => {
  it("reads a night's 5 to 9 PM weather", () => {
    expect(weatherOf(game("g", "2027-06-01", 1, 1), { "2027-06-01": night(84) })?.t).toBe(84)
    expect(weatherOf(game("g", "2027-06-02", 1, 1), {})).toBeNull()
  })
  it("splits at the median and calls a big, steady gap real", () => {
    const dates = ["2027-06-01", "2027-06-02", "2027-06-03", "2027-06-04", "2027-06-05", "2027-06-06"]
    const file = Object.fromEntries(dates.map((d, i) => [d, night(i < 3 ? 90 : 70)]))
    const games = dates.map((d, i) => (i < 3 ? game(`g${i}`, d, 30, 10) : game(`g${i}`, d, 10, 30)))
    const w = weatherGame({ players: [], games } as unknown as PooleanState, file)
    expect(w.ready).toBe(w.nights.length >= MIN_NIGHTS)
    expect(w.temp?.label).toEqual(["Warmer", "Cooler"])
    expect(w.temp?.a.fg).toBeCloseTo(0.75)
    expect(w.temp?.b.fg).toBeCloseTo(0.25)
    expect(w.temp?.real).toBe(true)
    expect(w.players[0].id).toBe("p")
    expect(w.players[0].lean).toBeGreaterThan(0)
    expect(w.players[0].lean).toBeLessThan(50) // leaned toward no difference
  })
  it("calls a small gap no clear difference", () => {
    const dates = ["2027-06-01", "2027-06-02", "2027-06-03", "2027-06-04"]
    const file = Object.fromEntries(dates.map((d, i) => [d, night(i < 2 ? 90 : 70)]))
    const games = dates.map((d, i) => game(`g${i}`, d, i < 2 ? 11 : 10, 10))
    expect(weatherGame({ players: [], games } as unknown as PooleanState, file).temp?.real).toBe(false)
  })
})
