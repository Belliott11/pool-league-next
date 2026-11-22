import { expect, test } from "vitest"
import type { Clip } from "@/lib/clips"
import { slideClips, type Slide } from "@/lib/wrapped"

const clip = (gameId: string, time: number, kind: Clip["kind"] = "shot"): Clip => ({ gameId, date: "2026-08-01", time, playerId: "a", kind, label: "Bucket", score: 1 })
const slide = (kind: string, extra: object = {}) => ({ kind, ...extra }) as unknown as Slide

test("each slide gets its own play, the best game keeps its play, and the same moment is not shown twice", () => {
  const best = clip("g1", 100)
  const slides = [slide("intro"), slide("totals"), slide("best", { clip: best }), slide("teammate"), slide("rival"), slide("summary")]
  const pool = [best, clip("g1", 104, "still"), clip("g2", 50), clip("g2", 50), clip("g3", 10)]
  const got = slideClips(slides, pool)
  expect(got.map((c) => c && `${c.gameId}@${c.time}`)).toEqual(["g2@50", "g3@10", "g1@100", undefined, undefined, undefined])
})
