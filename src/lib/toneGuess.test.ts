import { expect, test } from "vitest"
import TONES from "@/data/headline-tones.json"
import { guessTone } from "@/lib/toneGuess"
import type { PooleanState } from "@/lib/types"

const empty = { players: [], games: [] } as unknown as PooleanState

test("guessed from the other marked headlines, a sure guess is right on nearly all of the judged lines", () => {
  let sure = 0, right = 0
  for (const [line, [, tone]] of Object.entries(TONES as unknown as Record<string, [string, string]>)) {
    const g = guessTone(empty, line) // leaves the line itself out
    if (!g) continue
    sure++
    if (g.tone === tone) right++
  }
  expect(sure).toBeGreaterThan(40)
  expect(right / sure).toBeGreaterThan(0.85)
})

test("no guess for words it has never seen, and the editor's marks teach it", () => {
  expect(guessTone(empty, "Zzz qqq xxyy")).toBeNull()
  const line = "Ben glorped the frobnicator again"
  const taught = { ...empty, headlineTones: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`Ben glorped the frobnicator ${"x".repeat(i + 3)}`, ["ben", "bad"]])) } as unknown as PooleanState
  expect(guessTone(taught, line)?.tone).toBe("bad")
})
