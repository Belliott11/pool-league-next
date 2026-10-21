import { describe, expect, it } from "vitest"
import { countdownLabel, eveningOf } from "@/lib/weather"
import { recentForm } from "@/lib/gamePreview"
import type { Game, PooleanState } from "@/lib/types"

describe("evening weather", () => {
  const h = {
    time: ["2026-10-24T16:00", "2026-10-24T17:00", "2026-10-24T18:00", "2026-10-24T21:00", "2026-10-24T22:00"],
    temperature_2m: [80, 70, 72, 66, 40],
    precipitation_probability: [0, 10, 40, 20, 90],
    weathercode: [0, 1, 3, 61, 95],
  }
  it("averages 5 to 9 PM, takes the worst rain chance, and ignores other hours", () => {
    expect(eveningOf(h, "2026-10-24")).toEqual({ tempF: 69, rainPct: 40, label: "Rain" })
    expect(eveningOf(h, "2026-10-25")).toBeNull()
  })
})

describe("countdown", () => {
  it("says tonight, tomorrow and days, and nothing for the past", () => {
    expect(countdownLabel("2026-10-21", "2026-10-21")).toBe("Tonight")
    expect(countdownLabel("2026-10-22", "2026-10-21")).toBe("Tomorrow")
    expect(countdownLabel("2026-10-26", "2026-10-21")).toBe("In 5 days")
    expect(countdownLabel("2026-10-20", "2026-10-21")).toBeNull()
  })
})

describe("recent form", () => {
  const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
  const g = (id: string, date: string, x: number, y: number): Game => ({ ...base, id, date, teamA: ["x"], teamB: ["y"], liveScores: [{ pid: "x", points: x }, { pid: "y", points: y }] })
  it("lists results before the game, oldest first, never the game itself", () => {
    const games = [g("1", "2026-10-01", 5, 3), g("2", "2026-10-08", 2, 5), g("3", "2026-10-15", 4, 4), g("4", "2026-10-22", 9, 0)]
    const state: PooleanState = { players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }], games }
    expect(recentForm(state, "x", games[3])).toEqual(["W", "L", "T"])
    expect(recentForm(state, "y", games[3])).toEqual(["L", "W", "T"])
    expect(recentForm(state, "x", games[0])).toEqual([])
  })
})
