import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const st = await import("@/lib/seasonTeams")
const { startNewSeason } = await import("@/lib/newSeason")

let n = 0
const game = (date: string, teamA: string[], teamB: string[], winner: "A" | "B", extra: Partial<Game> = {}): Game =>
  ({ id: `g${n++}`, date, teamA, teamB, winner, stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [], liveScores: [{ pid: teamA[0], points: 2 }], ...extra }) as unknown as Game

describe("the draft", () => {
  it("snakes: 1, 2, 3, 3, 2, 1", () => {
    let set = st.newSet("2027-06-01", [{ name: "Sharks", captain: "a" }, { name: "", captain: "b" }, { name: "Jets", captain: "c" }])
    expect(set.teams[1].name).toBe("Team 2")
    const order: string[] = []
    for (const p of ["d", "e", "f", "g", "h", "i"]) {
      order.push(st.onTheClock(set)!.name)
      set = st.draftPick(set, p)
    }
    expect(order).toEqual(["Sharks", "Team 2", "Jets", "Jets", "Team 2", "Sharks"])
    expect(set.teams[0].members).toEqual(["a", "d", "i"])
    expect(st.draftPick(set, "d")).toBe(set) // already taken
    set = st.undoPick(set)
    expect(set.teams[0].members).toEqual(["a", "d"])
    expect(st.onTheClock(set)!.name).toBe("Sharks")
  })
})

describe("standings", () => {
  const set = { ...st.newSet("2027-06-01", [{ name: "Sharks", captain: "a" }, { name: "Jets", captain: "c" }]), drafting: false }
  set.teams[0].members = ["a", "b"]
  set.teams[1].members = ["c", "d"]
  const state = {
    players: [],
    games: [
      game("2027-06-01", ["a", "c"], ["b", "d"], "A"), // pickup: a and c win
      game("2027-06-01", ["a", "b"], ["c", "d"], "A"), // rivalry: Sharks beat Jets, wins count double
      game("2027-06-08", ["c", "x"], ["d", "y"], "A"), // only Jets play that night
      game("2027-05-20", ["a", "b"], ["c", "d"], "B"), // before the season: not counted
    ],
    seasonTeamSets: [set],
  } as unknown as PooleanState
  const s = st.standings(state, set)
  it("finds rivalry games", () => {
    expect(s.rivalries).toHaveLength(1)
    expect(s.rivalries[0].winner.name).toBe("Sharks")
  })
  it("counts each team's best nights, rivalry wins doubled", () => {
    const sharks = s.rows.find((r) => r.team.name === "Sharks")!
    const jets = s.rows.find((r) => r.team.name === "Jets")!
    // Night 1: a 1 + 2 = 3, b 0 + 2 = 2 (Sharks 2.5); c 1, d 0 (Jets 0.5). Night 2: only Jets, c 1, d 0.
    expect(sharks.wins).toBe(5)
    expect(sharks.nights).toBe(1)
    expect(sharks.score).toBeCloseTo(2.5, 10)
    expect(jets.wins).toBe(2)
    expect(jets.nights).toBe(2)
    expect(jets.score).toBeCloseTo(0.5, 10)
    expect(jets.rivalry).toEqual([0, 1])
    expect(s.rows[0].team.name).toBe("Sharks")
    expect(s.nights.map((x) => x.scores[0].team.name)).toEqual(["Sharks", "Jets"])
  })
  it("stops counting when the next season starts, but leaves a new season's teams open", () => {
    const next = startNewSeason({ ...state, currentSeasonStartedAt: "2027-06-01" }, "2028-06-01")
    expect(next.seasonTeamSets![0].to).toBe("2028-06-01")
    const fresh = { ...st.newSet("2028-06-01", [{ name: "A", captain: null }]), drafting: false }
    const again = startNewSeason({ ...next, seasonTeamSets: [...next.seasonTeamSets!, fresh] }, "2028-06-01")
    expect(again.seasonTeamSets![1].to).toBeUndefined()
    expect(st.champions(next)[0].line.team.name).toBe("Sharks")
  })
})

describe("best nights, trades and newcomers", () => {
  const base = { ...st.newSet("2027-06-01", [{ name: "Sharks", captain: "a" }, { name: "Jets", captain: "d" }]), drafting: false }
  base.teams[0].members = ["a", "b", "c"]
  base.teams[1].members = ["d", "e"]
  it("counts the same number for every team, so a weak extra night does not hurt", () => {
    // a and d win, b and e lose, c loses twice. Sharks have three there, Jets two: each counts its best two.
    const state = {
      players: [],
      games: [game("2027-06-01", ["a", "d"], ["b", "e"], "A"), game("2027-06-01", ["a", "e"], ["c", "b"], "A"), game("2027-06-01", ["d", "b"], ["c", "e"], "A")],
      seasonTeamSets: [base],
    } as unknown as PooleanState
    const s = st.standings(state, base)
    const sharks = s.rows.find((r) => r.team.name === "Sharks")!
    expect(s.nights[0].counted).toBe(2)
    // a 2, b 1, c 0: best two average 1.5, and c's night is left out.
    expect(sharks.score).toBeCloseTo(1.5, 10)
    expect(sharks.members.find((m) => m.id === "c")!.counted).toBe(0)
  })
  it("gives a team with one player there a bench night for the empty spot", () => {
    // Night 1 sets the bench: a 1, b 0, d 1, e 0, so the bottom quarter is 0. Night 2: only a for Sharks, d and e for Jets.
    const state = {
      players: [],
      games: [game("2027-06-01", ["a", "d"], ["b", "e"], "A"), game("2027-06-08", ["a", "d"], ["x", "e"], "A")],
      seasonTeamSets: [base],
    } as unknown as PooleanState
    const s = st.standings(state, base)
    expect(s.bench).toBeCloseTo(0, 10)
    const night = s.nights[1].scores.find((x) => x.team.name === "Sharks")!
    expect(night.filled).toBe(1)
    expect(night.score).toBeCloseTo(0.5, 10) // a's 1 plus a bench 0, over 2, not a's 1 alone
  })
  it("keeps a traded player's earlier nights with their old team", () => {
    const moved = st.movePlayer(base, "b", base.teams[1].id, "2027-06-05")
    expect(moved.teams[1].members).toContain("b")
    expect(st.teamOn(moved, "b", "2027-06-01")!.name).toBe("Sharks")
    expect(st.teamOn(moved, "b", "2027-06-05")!.name).toBe("Jets")
    const state = { players: [], games: [game("2027-06-01", ["b", "a"], ["d", "e"], "A"), game("2027-06-08", ["b", "d"], ["a", "c"], "A")], seasonTeamSets: [moved] } as unknown as PooleanState
    const s = st.standings(state, moved)
    const lines = s.rows.flatMap((r) => r.members.filter((m) => m.id === "b").map((m) => [r.team.name, m.nights, m.current]))
    expect(lines).toEqual(expect.arrayContaining([["Sharks", 1, false], ["Jets", 1, true]]))
  })
  it("sends a newcomer to the team lowest in the standings, ties to fewer players", () => {
    const empty = { players: [], games: [], seasonTeamSets: [base] } as unknown as PooleanState
    expect(st.nextNewcomerTeam(empty, base)!.name).toBe("Jets") // nobody has played: Jets have fewer
    const state = { players: [], games: [game("2027-06-01", ["d", "e"], ["a", "b"], "A")], seasonTeamSets: [base] } as unknown as PooleanState
    expect(st.nextNewcomerTeam(state, base)!.name).toBe("Sharks")
    const joined = st.movePlayer(base, "z", base.teams[0].id, "2027-06-10")
    expect(joined.moves![0]).toEqual({ pid: "z", from: null, to: base.teams[0].id, date: "2027-06-10" })
    expect(st.teamOn(joined, "z", "2027-06-01")).toBeNull()
  })
})

describe("captain order", () => {
  it("puts the weakest captain first by power ranking, unknown players counting as low", async () => {
    const m = await import("@/lib/matchup")
    const power = (id: string) => m.powerOf(id) ?? m.UNKNOWN_PLAYER_PCT
    const teams = [{ captain: "phillip" }, { captain: "adam" }, { captain: "ben" }, { captain: "reilly" }]
    const ordered = st.captainOrder(teams).map((t) => t.captain!)
    for (let i = 1; i < ordered.length; i++) expect(power(ordered[i])).toBeGreaterThanOrEqual(power(ordered[i - 1]))
  })
})
