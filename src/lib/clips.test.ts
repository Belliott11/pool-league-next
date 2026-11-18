import { expect, test } from "vitest"
import { bestClips } from "@/lib/clips"
import type { PooleanState } from "@/lib/types"

const ev = (id: string, scorerId: string, t: number, extra: object = {}) => ({ id, scorerId, points: 2 as const, made: true, videoTime: t, ...extra })
const game = (id: string, date: string, scoringEvents: object[], video = "https://x/v.mp4") =>
  ({ id, date, videoUrl: video, teamA: ["a"], teamB: ["b"], stats: [], scoringEvents, turnoverEvents: [], stealEvents: [{ id: "s", playerId: "b", opponentId: "a", videoTime: 90 }], foulEvents: [] })

test("clips rank dunks and blocks over plain buckets, skip games with no video, and cap one game", () => {
  const s = {
    players: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    games: [
      game("g1", "2026-01-01", [ev("1", "a", 10), ev("2", "a", 20, { dunk: true }), ev("3", "a", 30, { points: 3 }), ev("4", "a", 40, { made: false, blockerId: "b" }), ev("5", "a", 50)]),
      game("g2", "2026-01-02", [ev("6", "a", 10, { dunk: true })], ""),
    ],
  } as unknown as PooleanState
  const all = bestClips(s, { limit: 10, perGame: 10 })
  expect(all.every((c) => c.gameId === "g1")).toBe(true)
  expect(all[0]).toMatchObject({ kind: "dunk", time: 20, label: "Dunk" })
  expect(all.find((c) => c.kind === "block")).toMatchObject({ playerId: "b", label: "Block on A" })
  expect(bestClips(s, { limit: 10, perGame: 2 })).toHaveLength(2)
  expect(bestClips(s, { pid: "b", limit: 5 }).map((c) => c.kind).sort()).toEqual(["block", "steal"])
})

test("a strip mixes kinds of play instead of taking the top three of one", () => {
  const s = {
    players: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    games: [game("g1", "2026-01-01", [ev("1", "a", 10, { dunk: true }), ev("2", "a", 20, { dunk: true }), ev("3", "a", 30, { dunk: true }), ev("4", "a", 40, { points: 3 }), ev("5", "a", 50, { made: false, blockerId: "b" })])],
  } as unknown as PooleanState
  const kinds = bestClips(s, { pid: "a", limit: 3, perGame: 5 }).map((c) => c.kind)
  expect(new Set(kinds).size).toBeGreaterThan(1)
})
