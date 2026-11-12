import { describe, expect, it } from "vitest"
import { leagueYardstick } from "@/lib/insight"
import { allGamesOf, carryNote, carryOver, isSeasonOnly, SEASON_MIN_GAMES, seasonView } from "@/lib/season"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const shot = (id: string, made: boolean): ScoringEvent => ({ id, scorerId: "a", points: 2, made, shotType: "drive", contestLevel: "none", shotLocation: { x: 50, y: 10 } })
const game = (id: string, date: string, evs: ScoringEvent[]): Game => ({ id, date, teamA: ["a"], teamB: ["b"], winner: "A", stats: [], scoringEvents: evs, turnoverEvents: [], stealEvents: [], foulEvents: [] })
const old = game("old", "2026-07-01", [1, 2, 3, 4, 5].map((i) => shot(`o${i}`, true)))
// b scores once from no logged spot, so the game is not a tie and the close-range group is untouched.
const now = game("now", "2026-09-01", [...[1, 2, 3, 4, 5].map((i) => shot(`n${i}`, false)), { id: "b1", scorerId: "b", points: 2, made: true }])
const state: PooleanState = { players: [], games: [old, now], currentSeasonStartedAt: "2026-08-20" }

describe("season view", () => {
  it("carries last season's games while the new season is short of games", () => {
    expect(seasonView(state, false).games.map((g) => g.id)).toEqual(["old", "now"])
    expect(carryOver(state)).toEqual({ start: "2026-08-20", from: "2026-07-01", seasonGames: 1, carried: 1 })
    expect(carryNote(state, false)).toContain("also count the last 1")
    expect(carryNote(state, true)).toBeNull()
    expect(isSeasonOnly(seasonView(state, false))).toBe(true)
  })
  it("carries only the most recent games needed, whole nights at a time, and none once the season is full", () => {
    const g = (id: string, date: string) => game(id, date, [{ id: `${id}1`, scorerId: "a", points: 2, made: true }])
    const past = Array.from({ length: 20 }, (_, i) => g(`p${i}`, `2026-07-${String(i + 1).padStart(2, "0")}`))
    const season = Array.from({ length: SEASON_MIN_GAMES - 3 }, (_, i) => g(`s${i}`, "2026-09-01"))
    const st: PooleanState = { players: [], games: [...past, ...season], currentSeasonStartedAt: "2026-08-20" }
    expect(carryOver(st)?.carried).toBe(3)
    expect(seasonView(st, false).games.filter((x) => x.date < "2026-08-20").map((x) => x.id)).toEqual(["p17", "p18", "p19"])
    const full: PooleanState = { ...st, games: [...past, ...season, g("a", "2026-09-02"), g("b", "2026-09-02"), g("c", "2026-09-02")] }
    expect(carryOver(full)?.carried).toBe(0)
    expect(seasonView(full, false).games.every((x) => x.date >= "2026-08-20")).toBe(true)
  })
  it("changes nothing before any season has been closed", () => {
    const fresh = { ...state, currentSeasonStartedAt: null }
    expect(seasonView(fresh, false)).toBe(fresh)
  })
  it("keeps the shot-quality yardstick on every game", () => {
    const view = seasonView(state, false)
    expect(allGamesOf(view)).toHaveLength(2)
    // Five makes last season and five misses this season: the same close drive is worth 1 point a shot over both.
    expect(leagueYardstick(view)(shot("q", false))).toBe(1)
  })
})
