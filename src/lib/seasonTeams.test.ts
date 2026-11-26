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
  it("averages wins per member per night, rivalry wins doubled", () => {
    const sharks = s.rows.find((r) => r.team.name === "Sharks")!
    const jets = s.rows.find((r) => r.team.name === "Jets")!
    // Sharks: a 1 + 2 = 3, b 0 + 2 = 2, over 2 member-nights.
    expect(sharks.wins).toBe(5)
    expect(sharks.memberNights).toBe(2)
    expect(sharks.score).toBeCloseTo(2.5, 10)
    // Jets: night 1 c 1, d 0; night 2 c 1, d 0: 2 wins over 4 member-nights.
    expect(jets.wins).toBe(2)
    expect(jets.memberNights).toBe(4)
    expect(jets.rivalry).toEqual([0, 1])
    expect(s.rows[0].team.name).toBe("Sharks")
    expect(s.nights.map((x) => x.best?.name)).toEqual(["Sharks", "Jets"])
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
