import { describe, expect, it } from "vitest"
import { leagueYardstick } from "@/lib/insight"
import { allGamesOf, isSeasonOnly, seasonView } from "@/lib/season"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const shot = (id: string, made: boolean): ScoringEvent => ({ id, scorerId: "a", points: 2, made, shotType: "drive", contestLevel: "none", shotLocation: { x: 50, y: 10 } })
const game = (id: string, date: string, evs: ScoringEvent[]): Game => ({ id, date, teamA: ["a"], teamB: ["b"], winner: "A", stats: [], scoringEvents: evs, turnoverEvents: [], stealEvents: [], foulEvents: [] })
const old = game("old", "2026-07-01", [1, 2, 3, 4, 5].map((i) => shot(`o${i}`, true)))
// b scores once from no logged spot, so the game is not a tie and the close-range group is untouched.
const now = game("now", "2026-09-01", [...[1, 2, 3, 4, 5].map((i) => shot(`n${i}`, false)), { id: "b1", scorerId: "b", points: 2, made: true }])
const state: PooleanState = { players: [], games: [old, now], currentSeasonStartedAt: "2026-08-20" }

describe("season view", () => {
  it("keeps only this season's games unless past seasons are included", () => {
    expect(seasonView(state, false).games.map((g) => g.id)).toEqual(["now"])
    expect(seasonView(state, true).games.map((g) => g.id)).toEqual(["old", "now"])
    expect(isSeasonOnly(seasonView(state, false))).toBe(true)
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
