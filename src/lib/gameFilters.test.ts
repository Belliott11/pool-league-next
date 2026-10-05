import { describe, expect, it } from "vitest"
import { EMPTY_FILTERS, gameMatchesFilters, parseSearch } from "@/lib/gameFilters"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const live = (id: string, date: string, a: string[], b: string[], scores: [string, number][], notes = ""): Game => ({
  ...base,
  id,
  date,
  notes,
  teamA: a,
  teamB: b,
  liveScores: scores.map(([pid, points]) => ({ pid, points })),
})
const players = [{ id: "adam", name: "Adam" }, { id: "ben", name: "Ben" }, { id: "zach", name: "Zach" }]
const state: PooleanState = { players, games: [] }
const big = live("big", "2026-08-16", ["adam"], ["ben"], [["adam", 3], ["adam", 3], ["adam", 3], ["adam", 2], ["ben", 2]], "championship")
const small = live("small", "2026-10-04", ["zach"], ["ben"], [["zach", 2], ["ben", 2]])
const text = (t: string) => ({ ...EMPTY_FILTERS, text: t })
const stat = (patch: Partial<typeof EMPTY_FILTERS.stat>) => ({ ...EMPTY_FILTERS, stat: { ...EMPTY_FILTERS.stat, ...patch } })

describe("parseSearch", () => {
  it("reads point phrases", () => {
    expect(parseSearch("10+").pts).toEqual({ op: "gte", value: 10 })
    expect(parseSearch("over 10").pts).toEqual({ op: "gt", value: 10 })
    expect(parseSearch("more than 12 points").pts).toEqual({ op: "gt", value: 12 })
    expect(parseSearch(">=8").pts).toEqual({ op: "gte", value: 8 })
    expect(parseSearch("under 5").pts).toEqual({ op: "lt", value: 5 })
  })

  it("keeps the other words", () => {
    expect(parseSearch("adam over 10").words).toEqual(["adam"])
    expect(parseSearch("august games").words).toEqual(["august"])
  })
})

describe("game search", () => {
  it("finds games where anybody scored over 10, counting live-scored points", () => {
    expect(gameMatchesFilters(state, big, text("over 10"))).toBe(true)
    expect(gameMatchesFilters(state, small, text("over 10"))).toBe(false)
    expect(gameMatchesFilters(state, big, text("11+"))).toBe(true)
    expect(gameMatchesFilters(state, big, text("12+"))).toBe(false)
  })

  it("matches every word, in any order, across names, month names and notes", () => {
    expect(gameMatchesFilters(state, big, text("ben adam"))).toBe(true)
    expect(gameMatchesFilters(state, big, text("august"))).toBe(true)
    expect(gameMatchesFilters(state, big, text("championship adam"))).toBe(true)
    expect(gameMatchesFilters(state, small, text("adam"))).toBe(false)
    expect(gameMatchesFilters(state, small, text("october zach"))).toBe(true)
  })

  it("matches a final score either way round", () => {
    expect(gameMatchesFilters(state, big, text("11-2"))).toBe(true)
    expect(gameMatchesFilters(state, big, text("2-11"))).toBe(true)
  })
})

describe("stat filter", () => {
  it("applies to any player when none is chosen", () => {
    expect(gameMatchesFilters(state, big, stat({ value: "10", op: "gt" }))).toBe(true)
    expect(gameMatchesFilters(state, small, stat({ value: "10", op: "gt" }))).toBe(false)
    expect(gameMatchesFilters(state, small, stat({ value: "3", op: "lt" }))).toBe(true)
  })

  it("applies to the chosen player only", () => {
    expect(gameMatchesFilters(state, big, stat({ playerId: "ben", value: "10", op: "gt" }))).toBe(false)
    expect(gameMatchesFilters(state, big, stat({ playerId: "adam", value: "11", op: "eq" }))).toBe(true)
  })
})
