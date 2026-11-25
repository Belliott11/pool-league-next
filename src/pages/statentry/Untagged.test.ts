import { expect, it } from "vitest"
import { needsTag } from "./Untagged"
import type { ScoringEvent } from "@/lib/types"

const shot = (o: Partial<ScoringEvent>) => ({ id: "s", scorerId: "a", points: 2, made: true, ...o }) as ScoringEvent

it("flags shots the defense stats cannot use", () => {
  expect(needsTag(shot({}))).toBe("defender")
  expect(needsTag(shot({ defenderIds: ["b"] }))).toBe("contest")
  expect(needsTag(shot({ defenderIds: ["b"], contestLevel: "heavy" }))).toBeNull()
  expect(needsTag(shot({ contestLevel: "none" }))).toBeNull() // "No defender" was chosen
  expect(needsTag(shot({ points: 1 }))).toBeNull() // free throws are not guarded
})
