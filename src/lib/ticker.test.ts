import { expect, test } from "vitest"
import { tickerItems } from "@/lib/ticker"
import type { PooleanState } from "@/lib/types"

test("reads saved lines in order: last night, up next, season", () => {
  const state = {
    players: [],
    games: [{ id: "g", date: "2020-01-02", teamA: [], teamB: [], scoringEvents: [] }],
    publishedStories: { nights: { "2020-01-02": { quick: [], full: ["night line"] } }, going: ["going line"], season: ["season line"] },
  } as unknown as PooleanState
  const items = tickerItems(state)
  expect(items[0].text).toBe("night line")
  expect([...new Set(items.map((i) => i.tag).slice(1))]).toEqual(["Up next", "Season"])
})

test("nothing written means no bar", () => {
  expect(tickerItems({ players: [], games: [{ id: "g", date: "", teamA: [], teamB: [], scoringEvents: [{}] }, { id: "h", date: "", teamA: [], teamB: [], scoringEvents: [{}] }, ...Array(20).fill({ id: "x", date: "", teamA: [], teamB: [], scoringEvents: [{}] })] } as unknown as PooleanState)).toEqual([])
})
