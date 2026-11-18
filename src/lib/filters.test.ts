import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_FILTERS, insideFences, setFilters } from "@/lib/filters"
import { games } from "@/lib/insight"
import { leagueLineups } from "@/lib/lineups"
import { averageTrips, possessions } from "@/lib/possessions"
import { computeLeaderboard, qualifyingGamesForPlayer } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

let n = 0
const shot = (scorerId: string, made = true) => ({ id: `e${n++}`, scorerId, points: 2 as const, made, videoTime: n })
const stat = (playerId: string, pts: number) => ({ playerId, pts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 })
const mk = (id: string, a: string[], b: string[], aShots: number, bShots: number, aWins = aShots > bShots): Game =>
  ({
    id, date: `2026-01-${id}`, teamA: a, teamB: b, winner: aWins ? "A" : "B", liveTarget: 8,
    stats: [...a.map((p) => stat(p, (aShots * 2) / a.length)), ...b.map((p) => stat(p, (bShots * 2) / b.length))],
    scoringEvents: [...Array.from({ length: aShots }, () => shot(a[0])), ...Array.from({ length: bShots }, () => shot(b[0]))],
    turnoverEvents: [], stealEvents: [], foulEvents: [],
  }) as unknown as Game

const even = mk("01", ["a"], ["b"], 4, 2)
const uneven = mk("02", ["a", "c"], ["b"], 4, 2)
const state = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }], games: [even, uneven] } as unknown as PooleanState

afterEach(() => setFilters(DEFAULT_FILTERS))

describe("Include imbalanced games", () => {
  it("leaves uneven teams out by default and brings them in when on", () => {
    expect(qualifyingGamesForPlayer(state, "a")).toEqual([even])
    expect(games(state)).toEqual([even])
    expect(possessions(state).league.games).toBe(1)
    setFilters({ imbalanced: true })
    expect(qualifyingGamesForPlayer(state, "a")).toEqual([even, uneven])
    expect(games(state)).toEqual([even, uneven])
    expect(possessions(state).league.games).toBe(2)
    expect(computeLeaderboard(state).find((r) => r.player.id === "a")!.gp).toBe(2)
  })
  it("applies to lineups too", () => {
    const rows = Array(4).fill(0).map((_, i) => mk(`1${i}`, ["a", "c"], ["b"], 4, 2))
    const s = { players: [], games: rows } as unknown as PooleanState
    const withC = () => leagueLineups(s, 2).some((l) => l.ids.includes("c")) // the old site's games are in there too
    expect(withC()).toBe(false)
    setFilters({ imbalanced: true })
    expect(withC()).toBe(true)
  })
  it("never moves the pace baseline", () => {
    const before = averageTrips(state.games)
    setFilters({ imbalanced: true })
    expect(averageTrips(state.games)).toBe(before)
  })
})

describe("Include outlier games", () => {
  it("finds the values outside the usual range", () => {
    expect(insideFences([5, 5, 6, 6, 5, 40])).toEqual([true, true, true, true, true, false])
  })
  it("drops a player's outlier game only when off and with 4 or more games", () => {
    const ok = [0, 1, 2, 3, 4].map((i) => mk(`2${i}`, ["a"], ["b"], 4, 2))
    const wild = mk("29", ["a"], ["b"], 16, 0) // a runs away with it
    const s = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [...ok, wild] } as unknown as PooleanState
    expect(qualifyingGamesForPlayer(s, "a")).toHaveLength(6)
    setFilters({ outliers: false })
    expect(qualifyingGamesForPlayer(s, "a")).toHaveLength(5)
    const few = { ...s, games: [ok[0], ok[1], wild] } as PooleanState
    expect(qualifyingGamesForPlayer(few, "a")).toHaveLength(3)
  })
})
