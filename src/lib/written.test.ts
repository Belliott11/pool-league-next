import { expect, test, vi } from "vitest"
import reads from "@/data/advanced-reads.json"
import headlines from "@/data/custom-headlines.json"
import { FORMULA_VERSION } from "@/lib/formulaVersion"

const empty = { players: [], games: [] } as never

test("both hand-written files are stamped with a formula version that exists", () => {
  expect(reads.formula).toBeGreaterThan(0)
  expect(reads.formula).toBeLessThanOrEqual(FORMULA_VERSION)
  expect(headlines.formula).toBeGreaterThan(0)
  expect(headlines.formula).toBeLessThanOrEqual(FORMULA_VERSION)
})

test("every written read has its work-on lines, scouting lines and season sentence, with no em dashes", () => {
  for (const [id, r] of Object.entries(reads.players) as [string, { headline: string; text: string[]; workOn: string[]; strengths: string; guard: string; season: string }][]) {
    expect(r.workOn.length, id).toBeGreaterThanOrEqual(2)
    expect(r.strengths && r.guard && r.season, id).toBeTruthy()
    expect([r.headline, ...r.text, ...r.workOn, r.strengths, r.guard, r.season].join(" "), id).not.toContain("—")
  }
})

test("written headlines step aside when a stat formula changed after they were written", async () => {
  vi.resetModules()
  vi.doMock("@/lib/formulaVersion", () => ({ FORMULA_VERSION: 99 }))
  const behind = await import("@/lib/published")
  expect(behind.headlinesFormulaStale()).toBe(true)
  expect(behind.customStories(empty, "going")).toBeNull()
  expect(behind.customNight("2026-08-16")).toBeNull()
  vi.doUnmock("@/lib/formulaVersion")
  vi.resetModules()
  const current = await import("@/lib/published")
  expect(current.headlinesFormulaStale()).toBe(false)
  expect(current.customStories(empty, "going")).not.toBeNull()
  expect(current.customNight("2026-08-16")).not.toBeNull()
})
