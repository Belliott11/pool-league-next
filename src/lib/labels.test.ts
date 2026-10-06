import { describe, expect, it } from "vitest"
import { isHidden, labelLine, labelInjuryNotes, labelsOf, LABELS, ownLine, setApprovedLines, setHiddenLines, setLineNames, weighted, finalSet } from "@/lib/labels"
import type { PooleanState } from "@/lib/types"

const state = (labels: Record<string, string[]>): PooleanState => ({ players: [{ id: "a", name: "A" }], games: [], playerLabels: labels })

describe("labels", () => {
  it("writes a line from the player's own label, filling in the details", () => {
    const line = labelLine(state({ a: ["brickLayer"] }), "a", "cold", { n: "Adam", fg: "2-for-11" }, "2026-10-06")
    expect(line).toContain("Adam")
    expect(line).toContain("2-for-11")
    expect(line).not.toMatch(/\{\w+\}/)
  })

  it("has nothing to say for a player without a fitting label", () => {
    expect(labelLine(state({}), "a", "cold", { n: "Adam", fg: "x" }, "s")).toBeNull()
    expect(labelLine(state({ a: ["lockdown"] }), "a", "foul", { n: "Adam", k: 5 }, "s")).toBeNull()
  })

  it("works for a label typed by hand", () => {
    const line = labelLine(state({ a: ["Sunday Hero"] }), "a", "mvp", { n: "Adam", pts: 12 }, "s")
    expect(line).toContain("sunday hero")
    expect(line).toContain("Adam")
  })

  it("is the same every time for the same moment", () => {
    const s = state({ a: ["gunner", "brickLayer"] })
    expect(labelLine(s, "a", "cold", { n: "A", fg: "1-for-9" }, "d")).toEqual(labelLine(s, "a", "cold", { n: "A", fg: "1-for-9" }, "d"))
  })

  it("offers injury notes drawn from labels", () => {
    expect(labelInjuryNotes(state({ a: ["veteranKnees"] }), "a", "injury").length).toBeGreaterThan(0)
    expect(labelsOf(state({ a: ["gunner"] }), "a")).toEqual(["gunner"])
  })

  it("every library label has a name, a blurb and no stray em dashes or pronouns", () => {
    for (const l of LABELS) {
      expect(l.name.length).toBeGreaterThan(2)
      expect(l.blurb.length).toBeGreaterThan(5)
      const all = [...Object.values(l.lines).flat(), ...(l.injury ?? []), ...(l.away ?? []), ...(l.back ?? [])].join(" ")
      expect(all).not.toMatch(/—/)
      expect(all).not.toMatch(/\b(he|she|his|her|him)\b/i)
    }
  })

  it("uses the editor's own line for a player, and keeps it out of the label list", () => {
    const st = state({ a: [ownLine("cold", "{n} blamed the rim again, {fg}.")] })
    expect(labelsOf(st, "a")).toEqual([])
    expect(labelLine(st, "a", "cold", { n: "Adam", fg: "1-for-8" }, "s")).toBe("Adam blamed the rim again, 1-for-8.")
    expect(labelLine(st, "a", "hot", { n: "Adam", fg: "x" }, "s")).toBeNull()
  })

  it("skips a headline the editor removed", () => {
    const st = state({ a: [ownLine("cold", "{n} blamed the rim again, {fg}.")] })
    setHiddenLines(["Adam blamed the rim again, 1-for-8."])
    expect(labelLine(st, "a", "cold", { n: "Adam", fg: "1-for-8" }, "s")).toBeNull()
    setHiddenLines([])
  })
})

describe("reviewed lines", () => {
  it("removes a wording for every name and number, and boosts approved ones", () => {
    setLineNames(["Adam", "Ben"])
    setHiddenLines(["Adam shot 2-for-9 and kept shooting."])
    expect(isHidden("Ben shot 5-for-12 and kept shooting.")).toBe(true)
    expect(isHidden("Ben shot 5-for-12 and stopped.")).toBe(false)
    setApprovedLines(["Ben went 0-3."])
    expect(weighted(["Adam went 0-5.", "Other."])).toEqual(["Adam went 0-5.", "Adam went 0-5.", "Other."])
    setHiddenLines([])
    setApprovedLines([])
  })

  it("uses only the approved wordings once a type has enough of them", () => {
    setApprovedLines(["One.", "Two.", "Three."])
    expect(finalSet(["One.", "Two.", "Three.", "Four."], 3)).toEqual(["One.", "Two.", "Three."])
    expect(finalSet(["One.", "Two.", "Four."], 3)).toEqual(["One.", "Two.", "Four."])
    setApprovedLines([])
  })
})
