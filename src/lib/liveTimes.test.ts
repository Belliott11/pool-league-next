import { expect, test } from "vitest"
import { addLiveScore, finishLive, startLive } from "@/lib/live"
import type { PooleanState } from "@/lib/types"

test("a live game records when it started and finished, and when each basket was scored", () => {
  const before = Date.now()
  let s = startLive({ players: [], games: [] } as unknown as PooleanState, "g1", "2026-11-22", ["a"], ["b"], 21)
  s = addLiveScore(s, "g1", "a", 2)
  s = finishLive(s, "g1")
  const g = s.games[0]
  expect(Date.parse(g.startedAt!)).toBeGreaterThanOrEqual(before - 1000)
  expect(Date.parse(g.endedAt!)).toBeGreaterThanOrEqual(Date.parse(g.startedAt!))
  expect(g.liveScores![0].at).toBeGreaterThanOrEqual(before)
})
