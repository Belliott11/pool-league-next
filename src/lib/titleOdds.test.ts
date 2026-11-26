import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const st = await import("@/lib/seasonTeams")
const { titleOdds } = await import("@/lib/titleOdds")

let n = 0
const game = (date: string, teamA: string[], teamB: string[], winner: "A" | "B"): Game =>
  ({ id: `g${n++}`, date, teamA, teamB, winner, stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], liveScores: [{ pid: teamA[0], points: 2 }] }) as unknown as Game

describe("title odds", () => {
  const set = { ...st.newSet("2027-06-01", [{ name: "Sharks", captain: "a" }, { name: "Jets", captain: "c" }]), drafting: false, nights: 6 }
  set.teams[0].members = ["a", "b"]
  set.teams[1].members = ["c", "d"]
  // Sharks win every game for four nights.
  const games = ["2027-06-01", "2027-06-08", "2027-06-15", "2027-06-22"].flatMap((d) => [game(d, ["a", "b"], ["c", "d"], "A"), game(d, ["a", "b"], ["c", "d"], "A")])
  const state = { players: [], games, seasonTeamSets: [set] } as unknown as PooleanState
  it("adds up to one, favors the team that keeps winning, and gives the same numbers every time", () => {
    const t = titleOdds(state, set)
    expect(t.left).toBe(2)
    expect(t.lines.reduce((a, l) => a + l.odds, 0)).toBeCloseTo(1, 10)
    expect(t.lines[0].team.name).toBe("Sharks")
    expect(t.lines[0].odds).toBeGreaterThan(0.95)
    expect(titleOdds(state, set)).toEqual(t)
    expect(t.lines[0].change).not.toBeNull()
  })
  it("hands the title to the leader once every night is played, and is even before any", () => {
    expect(titleOdds(state, { ...set, nights: 4 }).lines[0]).toMatchObject({ odds: 1 })
    const empty = titleOdds({ ...state, games: [] } as unknown as PooleanState, set)
    for (const l of empty.lines) expect(l.odds).toBeGreaterThan(0.4)
  })
})
