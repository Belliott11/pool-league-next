import { describe, expect, it } from "vitest"
import { summarizeNight } from "@/lib/nightRecap"
import { nightCallouts, recordBook } from "@/lib/records"
import { lineSink, setLineNames } from "@/lib/labels"
import { abnormality, nightStories, previewStories, rank, streaks } from "@/lib/storylines"
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
    expect(stories.join(" ")).toMatch(/X.*\b3\b|\b3\b.*X/)
    expect(stories.join(" ")).toMatch(/0-3|Z/)
    expect(stories.join(" ")).toMatch(/record/)
  })

  it("flags an upset when a long shot wins", () => {
    const st = state([game("g1", "2026-10-06", ["x"], ["z"], [["z", 5], ["x", 2]])])
    const s = summarizeNight(st, "2026-10-06")
    const stories = nightStories(st, s, [], name, () => ({ pA: 0.8 }))
    expect(stories.join(" ")).toMatch(/Z/)
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

  it("rates a stat by how far it is from the player's own norm", () => {
    // X scored 5, 6, 7, 8, 2 before; Z scored 2, 3, 4, 1, 9.
    const abn = abnormality(state(history), "2026-10-06")
    const pts = (l: { pts: number }) => l.pts
    expect(abn("x", pts, 20)).toBeGreaterThan(abn("x", pts, 6))
    expect(abn("x", pts, 6)).toBeLessThan(1)
  })

  it("swaps to a wording that opens differently when the list would repeat itself", () => {
    const out = rank(
      [
        { w: 2, pid: null, text: "Adam went 0-3 tonight." },
        { w: 1, pid: null, text: "Adam went 2-for-9 tonight.", alts: ["Was Adam even looking at the rim? 2-for-9."] },
      ],
      5,
    )
    expect(out).toEqual(["Adam went 0-3 tonight.", "Was Adam even looking at the rim? 2-for-9."])
  })

  it("counts a double-double in one game, not across a night", () => {
    const stat = (playerId: string, pts: number, oreb: number, dreb: number) => ({ playerId, pts, oreb, dreb, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 })
    const box = (id: string, p: number, o: number, d: number): Game => ({ ...base, id, date: "2026-10-06", teamA: ["x"], teamB: ["z"], stats: [stat("x", p, o, d), stat("z", 2, 0, 0)], scoringEvents: [{ id: "e" + id } as never] })
    const said: string[] = []
    const run = (games: Game[]) => {
      said.length = 0
      lineSink.current = (options) => said.push(...options)
      const st = state(games)
      nightStories(st, summarizeNight(st, "2026-10-06"), [], name)
      lineSink.current = null
      return said.some((t) => t.includes("both stats at once"))
    }
    // 6 points and 6 rebounds in each of two games is 12 and 12 for the night, but never 10 and 10 in a game.
    expect(run([box("a", 6, 3, 3), box("b", 6, 3, 3)])).toBe(false)
    expect(run([box("a", 12, 6, 6)])).toBe(true)
  })

  it("never uses the same template twice in one list", () => {
    setLineNames(["Adam", "Alex"])
    const out = rank(
      [
        { w: 3, pid: null, text: "12 points ties the record for Adam.", alts: ["Adam matched the points record of 12."] },
        { w: 2, pid: null, text: "4 assists ties the record for Alex.", alts: ["Alex matched the assists record of 4."] },
        { w: 1, pid: null, text: "6 rebounds ties the record for Alex." },
      ],
      5,
    )
    setLineNames([])
    expect(out).toEqual(["12 points ties the record for Adam.", "Alex matched the assists record of 4."])
  })
})
