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
