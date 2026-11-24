import { expect, test } from "vitest"
import { seasonDue, startNewSeason, suggestSeasonName } from "@/lib/newSeason"
import type { PooleanState } from "@/lib/types"

const state = {
  players: [{ id: "a", name: "A" }],
  games: [{ id: "g1", date: "2026-08-16", masterVideoId: "m1" }],
  masterVideos: [{ id: "m1", url: "https://example.r2.dev/a.mp4" }],
  openingNight: { date: "2027-06-01", time: "16:00" },
  currentSeasonStartedAt: null,
} as unknown as PooleanState

test("starting a season only records dates: games, players and recordings are all kept", () => {
  const next = startNewSeason(state, "2027-06-01")
  expect(next.currentSeasonStartedAt).toBe("2027-06-01")
  expect(next.seasonHistory).toEqual([{ label: "Summer 2026", startedAt: null, endedAt: "2027-06-01" }])
  expect(next.games).toBe(state.games)
  expect(next.players).toBe(state.players)
  expect(next.masterVideos).toBe(state.masterVideos)
  expect(startNewSeason(state, "2027-06-01", "  The first one ").seasonHistory?.[0].label).toBe("The first one")
})

test("the editor is asked from opening night until the season is started", () => {
  expect(seasonDue(state, "2027-05-31")).toBeNull()
  expect(seasonDue(state, "2027-06-01")).toBe("2027-06-01")
  expect(seasonDue(state, "2027-06-20")).toBe("2027-06-01")
  expect(seasonDue(startNewSeason(state, "2027-06-01"), "2027-06-20")).toBeNull()
  expect(suggestSeasonName(state, "2027-06-01")).toBe("Summer 2026")
})
