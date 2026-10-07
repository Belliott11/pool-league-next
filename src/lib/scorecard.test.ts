import { describe, expect, it } from "vitest"
import { predictionNote, scorecard, winnerOf } from "@/lib/scorecard"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const game = (id: string, pA: number | null, scores: [string, number][], live = false): Game => ({
  ...base,
  id,
  date: "2026-10-06",
  teamA: ["x"],
  teamB: ["z"],
  liveScores: scores.map(([pid, points]) => ({ pid, points })),
  ...(live ? { liveInProgress: true } : {}),
  ...(pA === null ? {} : { prediction: { pA, at: "2026-10-06T00:00:00Z" } }),
})
const state = (games: Game[]): PooleanState => ({ players: [], games })

describe("prediction scorecard", () => {
  it("scores each saved pick against the real winner", () => {
    const sc = scorecard(
      state([
        game("a", 0.7, [["x", 5], ["z", 2]]), // favorite A won
        game("b", 0.6, [["x", 2], ["z", 5]]), // favorite A lost
        game("c", 0.3, [["x", 2], ["z", 5]]), // favorite B won
        game("d", null, [["x", 5]]), // no saved pick: not counted
        game("e", 0.8, [["x", 1]], true), // still being played: waiting
      ]),
    )
    expect(sc.called).toBe(3)
    expect(sc.correct).toBe(2)
    expect(sc.pct).toBe(67)
    expect(sc.waiting).toBe(1)
    expect(sc.buckets.find((b) => b.label === "70% or more")).toMatchObject({ called: 2, correct: 2 })
  })

  it("describes the pick next to the result", () => {
    expect(predictionNote(game("a", 0.7, [["x", 5], ["z", 2]]))).toBe("Model picked Team A (70%), right")
    expect(predictionNote(game("b", 0.7, [["x", 2], ["z", 5]]))).toBe("Model picked Team A (70%), wrong")
    expect(predictionNote(game("c", null, [["x", 2]]))).toBeNull()
    expect(winnerOf(game("d", 0.5, [["x", 2], ["z", 2]]))).toBeNull()
  })
})
