import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const st = await import("@/lib/seasonTeams")

let n = 0
const game = (date: string, teamA: string[], teamB: string[], winner: "A" | "B"): Game =>
  ({ id: `g${n++}`, date, teamA, teamB, winner, stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], liveScores: [{ pid: teamA[0], points: 2 }] }) as unknown as Game

describe("finals night", () => {
  const base = { ...st.newSet("2027-06-01", ["A", "B", "C", "D"].map((name) => ({ name, captain: name.toLowerCase() }))), drafting: false }
  base.teams.forEach((t) => (t.members = [t.captain!, t.captain! + "2"]))
  const team = (x: string) => [x, x + "2"]
  // The regular season: A best, then B, C, D.
  const season = [game("2027-06-01", team("a"), team("d"), "A"), game("2027-06-01", team("b"), team("c"), "A"), game("2027-06-08", team("a"), team("c"), "A"), game("2027-06-08", team("b"), team("d"), "A"), game("2027-06-15", team("a"), team("b"), "A"), game("2027-06-15", team("c"), team("d"), "A")]
  const state = { players: [], games: season, seasonTeamSets: [base] } as unknown as PooleanState
  const set = st.startFinals(state, base, "2027-07-01")
  it("seeds the top four from the standings", () => {
    expect(set.finals!.seeds.map((id) => set.teams.find((t) => t.id === id)!.name)).toEqual(["A", "B", "C", "D"])
  })
  it("plays semifinals, then a final to two wins, and ignores games that are not rivalry games or not in an open series", () => {
    const night = [
      game("2027-07-01", team("a"), team("d"), "B"), // D upsets A
      game("2027-07-01", ["b", "c"], ["b2", "c2"], "A"), // mixed teams: not a rivalry game
      game("2027-07-01", team("c"), team("b"), "A"), // C beats B
      game("2027-07-01", team("a"), team("b"), "A"), // both out: counts for nothing
      game("2027-07-01", team("c"), team("d"), "A"),
      game("2027-07-01", team("d"), team("c"), "A"),
      game("2027-07-01", team("c"), team("d"), "A"), // C takes the final 2-1
    ]
    const s2 = { ...state, games: [...season, ...night], seasonTeamSets: [set] } as unknown as PooleanState
    const f = st.finals(s2, set)
    expect(f.semis.map((x) => x.winner!.name)).toEqual(["D", "C"])
    expect(f.final.a!.name).toBe("C") // the higher seed of the two winners
    expect(f.final.wins).toEqual([2, 1])
    expect(f.champion!.name).toBe("C")
    const done = { ...s2, seasonTeamSets: [{ ...set, to: "2027-08-01" }] } as unknown as PooleanState
    expect(st.champions(done)[0]).toMatchObject({ finals: true })
    expect(st.champions(done)[0].line.team.name).toBe("C")
  })
  it("with two teams, goes straight to a final", () => {
    const two = { ...st.newSet("2027-06-01", [{ name: "A", captain: "a" }, { name: "B", captain: "b" }]), drafting: false }
    two.teams.forEach((t) => (t.members = [t.captain!, t.captain! + "2"]))
    const s = st.startFinals({ players: [], games: season.slice(4, 5), seasonTeamSets: [two] } as unknown as PooleanState, two, "2027-07-01")
    const f = st.finals({ players: [], games: [], seasonTeamSets: [s] } as unknown as PooleanState, s)
    expect(f.semis).toEqual([])
    expect([f.final.a!.name, f.final.b!.name]).toEqual(["A", "B"])
  })
})
