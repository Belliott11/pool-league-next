import { describe, expect, it } from "vitest"
import { ruleGaps, rulesForAdam, rulesText } from "@/lib/ruleIdeas"
import { searchRules } from "@/lib/rulesLookup"
import type { PooleanState } from "@/lib/types"

const empty = { players: [], games: [] } as unknown as PooleanState

describe("rules lookup", () => {
  it("finds the line people mean", () => {
    expect(searchRules("ball bounced off the coping")[0].text).toMatch(/coping/)
    expect(searchRules("can I hug him")[0].text).toMatch(/hug/i)
    expect(searchRules("goaltend")[0].text).toMatch(/goaltending/i)
    expect(searchRules("timeout")[0].text).toMatch(/timeout/i)
    expect(searchRules("zzz")).toEqual([])
  })
  it("puts the league's clarification beside the rule", () => {
    const notes = [{ id: "n", section: "Boundaries", text: "A ball off the ladder is out.", date: "2026-11-28" }]
    const hits = searchRules("ladder out of bounds", notes)
    expect(hits.some((h) => h.note && h.text.includes("ladder"))).toBe(true)
  })
})

describe("rule gaps", () => {
  it("drops a question once the rulebook answers it", () => {
    const text = rulesText()
    expect(ruleGaps(empty, text).some((g) => g.key === "length")).toBe(true)
    expect(ruleGaps(empty, text + " games are first to 21, win by 2.").some((g) => g.key === "length")).toBe(false)
  })
  it("drops a question the league answered with a clarification", () => {
    const answered = { ...empty, ruleNotes: [{ id: "n", section: "Possession", text: "Shoot for it from the line.", date: "2026-11-28", gap: "first-ball" }] }
    expect(ruleGaps(empty).some((g) => g.key === "first-ball")).toBe(true)
    expect(ruleGaps(answered).some((g) => g.key === "first-ball")).toBe(false)
  })
})

describe("rules for Adam", () => {
  it("groups the clarifications by section, in rulebook order", () => {
    expect(rulesForAdam(empty)).toBeNull()
    const text = rulesForAdam({ ...empty, ruleNotes: [
      { id: "a", section: "Fouls and penalties", text: "Free throws are dead balls.", date: "2026-11-28" },
      { id: "b", section: "Scoring", text: "First to 21, win by 2.", date: "2026-11-28" },
    ] })!
    expect(text.indexOf("Scoring:")).toBeLessThan(text.indexOf("Fouls and penalties:"))
    expect(text).toContain("- First to 21, win by 2.")
  })
})
