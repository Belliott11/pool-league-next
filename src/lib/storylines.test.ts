import { describe, expect, it } from "vitest"
import { summarizeNight } from "@/lib/nightRecap"
import { nightCallouts, recordBook } from "@/lib/records"
import { nightStories, previewStories, streaks } from "@/lib/storylines"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
// A game scored live: "scores" are [player, points] baskets.
const game = (id: string, date: string, a: string[], b: string[], scores: [string, number][]): Game => ({
  ...base,
  id,
  date,
  teamA: a,
  teamB: b,
  liveScores: scores.map(([pid, points]) => ({ pid, points })),
})
const name = (id: string) => id.toUpperCase()
const state = (games: Game[]): PooleanState => ({ players: [], games })

// Five nights of X (team A) against Z (team B); X wins the first four.
const history = [
  game("g1", "2026-09-01", ["x"], ["z"], [["x", 5], ["z", 2]]),
  game("g2", "2026-09-08", ["x"], ["z"], [["x", 6], ["z", 3]]),
  game("g3", "2026-09-15", ["x"], ["z"], [["x", 7], ["z", 4]]),
  game("g4", "2026-09-22", ["x"], ["z"], [["x", 8], ["z", 1]]),
  game("g5", "2026-09-29", ["x"], ["z"], [["z", 9], ["x", 2]]),
]

describe("records", () => {
  it("keeps the highest single-game points, and the first to set a mark keeps it on a tie", () => {
    const book = recordBook(state(history))
    expect(book.pts).toMatchObject({ value: 9, playerId: "z", gameId: "g5" })
    const tied = recordBook(state([...history, game("g6", "2026-10-06", ["x"], ["z"], [["x", 9], ["z", 1]])]))
    expect(tied.pts?.playerId).toBe("z")
  })

  it("calls out a new record and a tie, but nothing on the very first night", () => {
    expect(nightCallouts(state(history), "2026-09-01")).toEqual([])
    const broke = state([...history, game("g6", "2026-10-06", ["x"], ["z"], [["x", 6], ["x", 5], ["z", 1]])])
    expect(nightCallouts(broke, "2026-10-06")).toContainEqual(expect.objectContaining({ kind: "record", key: "pts", playerId: "x", value: 11, previous: 9 }))
    const tie = state([...history, game("g6", "2026-10-06", ["x"], ["z"], [["x", 5], ["x", 4], ["z", 1]])])
    expect(nightCallouts(tie, "2026-10-06")).toContainEqual(expect.objectContaining({ kind: "tied", key: "pts", value: 9 }))
  })
})

describe("streaks", () => {
  it("tracks the current run for each player", () => {
    const run = streaks(state(history.slice(0, 4)))
    expect(run.find((r) => r.id === "x")).toMatchObject({ kind: "W", n: 4 })
    expect(run.find((r) => r.id === "z")).toMatchObject({ kind: "L", n: 4 })
    expect(streaks(state(history)).find((r) => r.id === "x")).toMatchObject({ kind: "L", n: 1 })
  })
})

describe("storylines", () => {
  it("writes the night's story from the facts", () => {
    const st = state([...history, game("g6", "2026-10-06", ["x"], ["z"], [["x", 6], ["x", 5], ["z", 1]]), game("g7", "2026-10-06", ["x"], ["z"], [["x", 3], ["z", 2]]), game("g8", "2026-10-06", ["x"], ["z"], [["x", 4], ["z", 2]])])
    const s = summarizeNight(st, "2026-10-06")
    const stories = nightStories(st, s, nightCallouts(st, "2026-10-06"), name)
    expect(stories.join(" ")).toMatch(/3-0|all 3 games/)
    expect(stories.join(" ")).toMatch(/0-3|Z/)
    expect(stories.join(" ")).toContain("New league record")
  })

  it("flags an upset when a long shot wins", () => {
    const st = state([game("g1", "2026-10-06", ["x"], ["z"], [["z", 5], ["x", 2]])])
    const s = summarizeNight(st, "2026-10-06")
    const stories = nightStories(st, s, [], name, () => ({ pA: 0.8 }))
    expect(stories.join(" ")).toMatch(/Upset|beat the odds/)
    expect(stories.join(" ")).toContain("20%")
  })

  it("has nothing to say about the future until there are games", () => {
    expect(previewStories(state(history.slice(0, 2)), name)).toEqual([])
    expect(previewStories(state(history), name).join(" ")).toMatch(/shy of|owns the series|streak/)
  })

  it("notes a result against a specific opponent from the history", () => {
    // Z had won 1 of 5 against X, and wins tonight.
    const st = state([...history, game("g6", "2026-10-06", ["x"], ["z"], [["z", 6], ["x", 2]])])
    const stories = nightStories(st, summarizeNight(st, "2026-10-06"), [], name)
    expect(stories.join(" ")).toMatch(/Z .*X.*2-4/)
  })
})
