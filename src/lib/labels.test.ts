import { describe, expect, it } from "vitest"
import { labelLine, labelInjuryNotes, labelsOf, LABELS } from "@/lib/labels"
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
    expect(labelLine(state({ a: ["lockdown"] }), "a", "noshow", { n: "Adam" }, "s")).toBeNull()
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
})
