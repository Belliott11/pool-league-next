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

test("a streamed game keeps its stream as the game's video when it finishes, unless it already has one", () => {
  let s = startLive({ players: [], games: [] } as unknown as PooleanState, "g2", "2026-11-22", ["a"], ["b"], 21)
  s = { ...s, games: s.games.map((g) => ({ ...g, streamUrl: "https://youtube.com/live/abcdefghijk" })) }
  s = addLiveScore(s, "g2", "a", 2)
  expect(finishLive(s, "g2").games[0].videoUrl).toBe("https://youtube.com/live/abcdefghijk")
  const withVideo = { ...s, games: s.games.map((g) => ({ ...g, videoUrl: "https://example.com/v.mp4" })) }
  expect(finishLive(withVideo, "g2").games[0].videoUrl).toBe("https://example.com/v.mp4")
})
