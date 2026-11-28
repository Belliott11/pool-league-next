import { describe, expect, it } from "vitest"
import { storyline, type PreviewRow } from "@/lib/seasonPreview"

const row = (over: Partial<PreviewRow>): PreviewRow => ({ id: "a", parties: 5, record: null, crowns: 0, bestRank: null, awards: [], ppg: null, filmed: 0, form: null, trend: null, partner: null, ...over })
const name = (id: string) => id.toUpperCase()

describe("season preview storylines", () => {
  it("leads with awards and power-ranking nights", () => {
    expect(storyline(row({ awards: ["MVP"], crowns: 6 }), name)).toBe("Voted MVP last summer, and #1 in the power rankings at 6 parties.")
  })
  it("uses the record, the trend, picks and goals", () => {
    expect(storyline(row({ record: [7, 12] }), name)).toBe("A 7-12 summer to turn around.")
    expect(storyline(row({ trend: 0.5 }), name, { jumpVotes: 2 })).toBe("Finished the summer on the way up, and 2 people pick them to make a jump.")
    expect(storyline(row({}), name, { goal: "a 15-point game" })).toBe("Set a goal: a 15-point game.")
  })
  it("always says something", () => {
    expect(storyline(row({ partner: { id: "b", why: "5-1 together" } }), name)).toBe("Best with B (5-1 together).")
    expect(storyline(row({}), name)).toBe("5 parties last summer.")
  })
})
