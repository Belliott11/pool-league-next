import { expect, test } from "vitest"
import reads from "@/data/advanced-reads.json"
import { termsIn } from "@/lib/terms"

test("picks only the terms a text uses", () => {
  expect(termsIn(["Alex sits at -6.1 two-way per game."]).map(([k]) => k)).toEqual(["Per game", "Two-way score"])
  expect(termsIn(["Adam won 4 straight."])).toEqual([])
})

test("every written read gets its jargon defined", () => {
  const names = termsIn(reads.players.evan.text).map(([k]) => k)
  for (const k of ["TS%", "Real AST", "Defensive load", "Win chance added", "Set-up"]) expect(names).toContain(k)
})
