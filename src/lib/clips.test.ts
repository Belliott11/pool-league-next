import { expect, test } from "vitest"
import { bestClips, gameClips, reviewKey } from "@/lib/clips"
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

test("a highlight the editor marked comes first, and its automatic twin is dropped", () => {
  const g = { ...game("m1", "2026-01-01", [ev("1", "a", 100, { dunk: true }), ev("2", "a", 300, { points: 3 })]), plays: [{ id: "p", type: "highlight", start: 98, end: 108, playerId: "a", note: "" }, { id: "q", type: "lowlight", start: 10, end: 20, playerId: "a" }] }
  const s = { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [g] } as unknown as PooleanState
  const out = bestClips(s, { pid: "a", limit: 5, perGame: 5 })
  expect(out[0]).toMatchObject({ marked: true, kind: "marked", from: 98, label: "Marked highlight" })
  expect(out.filter((c) => c.kind === "dunk")).toHaveLength(0)
  expect(out.some((c) => c.kind === "three")).toBe(true)
})

const reviewed = (reviews: object[]) => {
  const g = { ...game("r1", "2026-10-01", [ev("1", "a", 10, { dunk: true }), ev("2", "a", 20)]), clipReviews: reviews }
  return { players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [g] } as unknown as PooleanState
}
const dunk = (s: PooleanState) => gameClips(s, s.games[0]).find((c) => c.kind === "dunk")!

test("a kept clip is marked reviewed and leads, a skipped one is gone", () => {
  const key = reviewKey(dunk(reviewed([])))
  expect(dunk(reviewed([{ key, verdict: "keep", who: ["a"] }]))).toMatchObject({ reviewed: true })
  expect(gameClips(reviewed([{ key, verdict: "skip" }]), reviewed([{ key, verdict: "skip" }]).games[0]).some((c) => c.kind === "dunk")).toBe(false)
})

test("a clip marked rough for a player stays off their pages but shows for others in the shot", () => {
  const key = reviewKey(dunk(reviewed([])))
  const s = reviewed([{ key, verdict: "keep", who: ["a", "b"], looks: { b: "bad" } }])
  expect(bestClips(s, { pid: "b" }).some((c) => c.kind === "dunk")).toBe(false)
  expect(bestClips(s, { pid: "a" }).some((c) => c.kind === "dunk")).toBe(true)
})

test("a rough clip is used for bad news about that player and a described clip is matched to the headline", () => {
  const key = reviewKey(dunk(reviewed([])))
  const s = reviewed([{ key, verdict: "keep", who: ["a", "b"], looks: { b: "bad" }, note: "Ben gets dunked on" }])
  expect(bestClips(s, { pid: "b", mood: "bad" })[0]).toMatchObject({ kind: "dunk", label: "Ben gets dunked on" })
  expect(bestClips(s, { pid: "a", mood: "bad" })).toHaveLength(0)
  const t = reviewed([{ key, verdict: "keep", note: "Left hand finish at the rim" }])
  expect(bestClips(t, { pid: "a", about: "Adam finished at the rim all night", limit: 1 })[0].label).toBe("Left hand finish at the rim")
})

test("a headline gets a good clip for good news, a rough one for bad news, and none when nothing rough exists", async () => {
  const { headlineClip } = await import("@/lib/headlineClips")
  const key = reviewKey(dunk(reviewed([])))
  const none = reviewed([])
  expect(headlineClip(none, "A scored from everywhere")?.kind).toBeDefined()
  expect(headlineClip(none, "A struggled all night")).toBeUndefined()
  const rough = reviewed([{ key, verdict: "keep", who: ["a"], looks: { a: "bad" } }])
  expect(headlineClip(rough, "A struggled all night")?.kind).toBe("dunk")
  expect(headlineClip(rough, "A scored from everywhere")?.kind).not.toBe("dunk")
})

test("a hand-picked still is a clip of its own, held as a still, and removing it takes it away", () => {
  const pick = { key: "33|a", verdict: "keep", still: { time: 33.4, playerId: "a" }, note: "Adam hugs Ben after the win", frame: { z: 1.5, x: 0.4, y: 0.4 } }
  const s = reviewed([pick])
  const still = gameClips(s, s.games[0]).find((c) => c.kind === "still")!
  expect(still).toMatchObject({ playerId: "a", time: 33.4, label: "Adam hugs Ben after the win", reviewed: true, frame: { z: 1.5, x: 0.4, y: 0.4 } })
  expect(bestClips(s, { pid: "a", limit: 1 })[0].kind).toBe("still")
  const gone = reviewed([{ ...pick, verdict: "skip" }])
  expect(gameClips(gone, gone.games[0]).some((c) => c.kind === "still")).toBe(false)
})
