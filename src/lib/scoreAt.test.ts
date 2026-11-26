import { expect, it } from "vitest"
import { LAG, scoreAt } from "@/lib/scoreAt"
import type { OddsStep } from "@/lib/oddsTimeline"

const step = (index: number, side: "A" | "B", a: number, b: number, videoTime: number | null, after: number): OddsStep => ({ index, side, scorerId: "x", assistId: null, points: 2, a, b, before: 0.5, after, videoTime, ends: false })

it("shows the score after each basket once it has gone in, and nothing outside the game's stretch", () => {
  const steps = [step(0, "A", 2, 0, 100, 0.6), step(1, "B", 2, 2, 130, 0.5), step(2, "A", 4, 2, 160, 0.7)]
  expect(scoreAt(steps, 0.5, 30)).toBeNull() // long before the game
  expect(scoreAt(steps, 0.5, 90)).toMatchObject({ a: 0, b: 0, odds: 0.5, last: null })
  expect(scoreAt(steps, 0.5, 100 + LAG - 0.1)).toMatchObject({ a: 0, b: 0 }) // the shot is up, not in yet
  expect(scoreAt(steps, 0.5, 100 + LAG + 0.1)).toMatchObject({ a: 2, b: 0, fresh: true })
  expect(scoreAt(steps, 0.5, 145)).toMatchObject({ a: 2, b: 2, odds: 0.5, fresh: false })
  expect(scoreAt(steps, 0.5, 400)).toBeNull() // long after
  expect(scoreAt([step(0, "A", 2, 0, null, 0.6)], 0.5, 10)).toBeNull() // no video times: no overlay
})
