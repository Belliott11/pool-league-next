import { expect, test } from "vitest"
import { addReview, newReview, reviewTime, settled, updateReview } from "@/lib/reviews"
import type { Game, PooleanState } from "@/lib/types"

const rec = Date.UTC(2026, 7, 16, 23, 0, 0)
const game = { id: "g1", date: "2026-08-16", teamA: [], teamB: [], masterVideoId: "m1", scoringEvents: [] } as unknown as Game
const state = { players: [{ id: "ben", name: "Ben" }], games: [game], masterVideos: [{ id: "m1", name: "Aug 16", recordedAt: new Date(rec).toISOString() }] } as unknown as PooleanState

test("a flagged moment is found in the recording by the clock, and a time set by hand wins", () => {
  let s = addReview(state, "g1", newReview(rec + 125_400, "  foul on Ben  ", "ben"))
  const r = s.games[0].reviews![0]
  expect(r).toMatchObject({ note: "foul on Ben", by: "ben" })
  expect(reviewTime(s, s.games[0], r)).toBe(125.4)
  s = updateReview(s, "g1", r.id, { videoTime: 130 })
  expect(reviewTime(s, s.games[0], s.games[0].reviews![0])).toBe(130)
})

test("no place in the video before the recording's time is known, verdicts are kept, and a review can be removed", () => {
  const noRec = { ...state, masterVideos: [{ id: "m1", name: "Aug 16" }] } as unknown as PooleanState
  let s = addReview(noRec, "g1", newReview(rec + 5000))
  const id = s.games[0].reviews![0].id
  expect(reviewTime(s, s.games[0], s.games[0].reviews![0])).toBeNull()
  s = updateReview(s, "g1", id, { verdict: "overturned" })
  expect(settled(s.games)).toHaveLength(1)
  s = updateReview(s, "g1", id, null)
  expect(s.games[0].reviews).toEqual([])
})

test("a moment flagged while watching the stream keeps where the stream was, which needs no clock", () => {
  const noRec = { ...state, masterVideos: [{ id: "m1", name: "Aug 16" }] } as unknown as PooleanState
  const s = addReview(noRec, "g1", newReview(rec + 1, "in or out?", null, 1234.56))
  expect(reviewTime(s, s.games[0], s.games[0].reviews![0])).toBe(1234.6)
})

test("the tally counts flags, calls and who was right, most overturned first", async () => {
  const { reviewTally } = await import("@/lib/reviews")
  const g = (reviews: object[]) => ({ ...game, reviews }) as unknown as Game
  const t = reviewTally([g([{ id: "1", at: 1, by: "ben", verdict: "overturned" }, { id: "2", at: 2, by: "ben", verdict: "stands" }]), g([{ id: "3", at: 3, by: "zach", verdict: "overturned" }, { id: "4", at: 4, by: "zach", verdict: "overturned" }, { id: "5", at: 5 }])])
  expect(t).toMatchObject({ flagged: 5, settled: 4, overturned: 3 })
  expect(t.players.map((p) => [p.id, p.flagged, p.overturned, p.stood])).toEqual([["zach", 2, 2, 0], ["ben", 2, 1, 1]])
})
