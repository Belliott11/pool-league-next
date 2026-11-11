import { describe, expect, it } from "vitest"
import { fatigue, loadsFor, loadText, ordinal, slots } from "@/lib/dayLoad"
import type { Game, PooleanState } from "@/lib/types"

const old = (n: number, date: string, a: string[], b: string[], w: "A" | "B" = "A") => ({ n, date, a, b, w })
const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const state = (games: Game[] = []): PooleanState => ({ players: [], games })

describe("games played that day", () => {
  const games = [
    old(1, "2026-08-10", ["x", "y"], ["z", "w"]),
    old(2, "2026-08-10", ["x", "z"], ["y", "w"]),
    old(3, "2026-08-10", ["y", "w"], ["x", "z"]), // x and y played all three, and so did w
    old(4, "2026-08-10", ["x"], ["q"]), // x again, y sat
    old(1, "2026-08-16", ["x", "y"], ["z", "w"]), // a new night starts from zero
  ]
  const s = slots(state(), games)
  it("counts games earlier that day and starts over each night", () => {
    expect([...s].map((x) => x.loads.get("x")?.before)).toEqual([0, 1, 2, 3, 0])
    expect(s[2].loads.get("w")).toEqual({ before: 2, streak: 3 })
  })
  it("tracks the streak of consecutive games and resets it after sitting one out", () => {
    expect(s[3].loads.get("x")?.streak).toBe(4)
    expect(s[3].loads.get("q")).toEqual({ before: 0, streak: 1 })
    const g = [old(1, "d", ["a"], ["b"]), old(2, "d", ["c"], ["d"]), old(3, "d", ["a"], ["c"])]
    expect(slots(state(), g)[2].loads.get("a")).toEqual({ before: 1, streak: 1 })
  })
  it("finds the loads for an app game, taking the later one when the same teams played again", () => {
    const a: Game = { ...base, id: "a", date: "2026-08-10", teamA: ["x"], teamB: ["q"], winner: "A" }
    const b: Game = { ...a, id: "b" }
    const st = state([a, b])
    expect(loadsFor(st, a, [])?.get("x")?.before).toBe(0)
    expect(loadsFor(st, b, [])?.get("x")?.before).toBe(1)
  })
  it("groups results by games already played that day, for each player and the league", () => {
    const f = fatigue(state(), games)
    const league = f.find((r) => r.id === "")!
    expect(league.bands["0-2"].w + league.bands["0-2"].l + league.bands["3-5"].w + league.bands["3-5"].l).toBe(18)
    expect(f.find((r) => r.id === "x")!.bands["3-5"]).toEqual({ w: 1, l: 0 }) // x won the fourth game of the night
  })
  it("words it in plain ordinals", () => {
    expect(ordinal(1)).toBe("1st")
    expect(ordinal(12)).toBe("12th")
    expect(ordinal(23)).toBe("23rd")
    expect(loadText({ before: 2, streak: 3 })).toBe("3rd game today, 3 in a row")
    expect(loadText({ before: 0, streak: 1 })).toBe("1st game today")
  })
})
