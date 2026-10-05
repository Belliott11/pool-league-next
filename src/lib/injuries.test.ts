import { describe, expect, it } from "vitest"
import { goofyNote, injuryBoard, unavailable } from "@/lib/injuries"
import { seasonStories } from "@/lib/storylines"
import type { Game, Injury, PooleanState } from "@/lib/types"

const players = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }]
const inj = (id: string, playerId: string, status: Injury["status"], updatedAt: string): Injury => ({ id, playerId, status, note: "", updatedAt })

describe("injury board", () => {
  it("lists the worst first, then newest, and skips players who no longer exist", () => {
    const state: PooleanState = {
      players,
      games: [],
      injuries: [inj("1", "a", "dayToDay", "2026-10-01T00:00:00Z"), inj("2", "b", "out", "2026-09-01T00:00:00Z"), inj("3", "c", "out", "2026-10-02T00:00:00Z"), inj("4", "zzz", "out", "2026-10-03T00:00:00Z")],
    }
    expect(injuryBoard(state).map((i) => i.id)).toEqual(["3", "2", "1"])
    expect(unavailable(state).map((i) => i.playerId)).toEqual(["c", "b"])
  })

  it("has a silly note for every status and avoids repeating the current one", () => {
    for (const s of ["out", "away", "questionable", "dayToDay", "returning"] as const) {
      const n = goofyNote(s)
      expect(n.length).toBeGreaterThan(5)
      expect(goofyNote(s, n)).not.toBe(n)
    }
  })
})

describe("seasonStories", () => {
  const g = (id: string, date: string, a: number, b: number): Game => ({
    id,
    date,
    teamA: ["a"],
    teamB: ["b"],
    stats: [],
    scoringEvents: [],
    turnoverEvents: [],
    stealEvents: [],
    foulEvents: [],
    liveScores: [...Array(a)].map(() => ({ pid: "a", points: 1 })).concat([...Array(b)].map(() => ({ pid: "b", points: 1 }))),
  })

  it("says nothing until there are a few games", () => {
    expect(seasonStories({ players, games: [g("1", "2026-09-01", 5, 3)] }, (x) => x.toUpperCase())).toEqual([])
  })

  it("names the leader and the longest streak", () => {
    const games = [1, 2, 3, 4, 5, 6].map((i) => g(String(i), `2026-09-0${i}`, 6, 2))
    const out = seasonStories({ players, games }, (x) => x.toUpperCase()).join(" ")
    expect(out).toContain("A sets the pace at 6-0")
    expect(out).toContain("6-game win streak")
  })
})
