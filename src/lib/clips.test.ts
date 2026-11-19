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
  expect(bestClips(s, { pid: "b", limit: 5 }).map((c) => c.kind).sort()).toEqual(["block"]) // the steal at 90 has no score after it, so it is not a clip
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

test("a headline gets the clip its judged tone calls for: good for good news, rough for bad news, none when unlisted", async () => {
  const { headlineClip } = await import("@/lib/headlineClips")
  const key = reviewKey(dunk(reviewed([])))
  const tones = { "A scored from everywhere": ["a", "good"], "A had a night to forget": ["a", "bad"] } as never
  const none = reviewed([])
  expect(headlineClip(none, "A scored from everywhere", undefined, tones)?.kind).toBeDefined()
  expect(headlineClip(none, "A had a night to forget", undefined, tones)).toBeUndefined()
  expect(headlineClip(none, "Something unlisted about A", undefined, tones)).toBeUndefined()
  const rough = reviewed([{ key, verdict: "keep", who: ["a"], looks: { a: "bad" } }])
  expect(headlineClip(rough, "A had a night to forget", undefined, tones)?.kind).toBe("dunk")
  expect(headlineClip(rough, "A scored from everywhere", undefined, tones)?.kind).not.toBe("dunk")
})

const full = (events: object[], extra: object = {}) => ({ ...game("w1", "2026-10-01", events), ...extra })
const st = (g: object) => ({ players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games: [g] }) as unknown as PooleanState

test("a steal is a clip only when the thief's team scores within ten seconds", () => {
  const steal = { id: "s", playerId: "b", opponentId: "a", videoTime: 100 }
  const yes = full([ev("1", "b", 106)], { stealEvents: [steal] })
  const late = full([ev("1", "b", 130)], { stealEvents: [steal] })
  const other = full([ev("1", "a", 106)], { stealEvents: [steal] })
  expect(gameClips(st(yes), yes as never).find((c) => c.kind === "steal")?.label).toBe("Steal from A, then B scores")
  expect(gameClips(st(late), late as never).some((c) => c.kind === "steal")).toBe(false)
  expect(gameClips(st(other), other as never).some((c) => c.kind === "steal")).toBe(false)
})

test("the last basket of a close game that put the winners ahead is the game winner", () => {
  const g = full([ev("1", "a", 10), ev("2", "b", 20), ev("3", "a", 30), ev("4", "b", 40, { points: 3 })], { stealEvents: [] })
  // a 4, b 5: b's three at 40 took the lead from 4-2 down... a:2+2=4, b:2+3=5 so b leads by 1 and the three broke a deficit
  expect(gameClips(st(g), g as never).find((c) => c.kind === "winner")).toMatchObject({ playerId: "b", time: 40, label: "Game winner" })
  const blowout = full([ev("1", "a", 10), ev("2", "a", 20), ev("3", "a", 30), ev("4", "a", 40)], { stealEvents: [] })
  expect(gameClips(st(blowout), blowout as never).some((c) => c.kind === "winner")).toBe(false)
})

test("a contested bucket is a candidate of its own kind, and a miss out of bounds is a rough clip", () => {
  const g = full([ev("1", "a", 10, { contestLevel: "heavy" }), ev("2", "b", 20, { made: false }), ev("3", "b", 30, { made: false }), ev("4", "a", 40), ev("5", "a", 50), ev("6", "a", 60)], { stealEvents: [], turnoverEvents: [{ id: "t", playerId: "b", missEventId: "2" }] })
  const clips = gameClips(st(g), g as never)
  expect(clips.find((c) => c.kind === "contested")?.label).toBe("Contested bucket")
  expect(clips.filter((c) => c.kind === "lowlight")).toMatchObject([{ playerId: "b", label: "Missed shot out of bounds", rough: ["b"] }])
})
