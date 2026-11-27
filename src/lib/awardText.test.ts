import { describe, expect, it } from "vitest"
import { AWARD_TEXT } from "@/lib/awardText"
import { AWARDS } from "@/lib/awardVote"
import { pastSeasonAwards } from "@/lib/pastAwards"

describe("award descriptions", () => {
  it("covers every award on this site's ballot and last season's", () => {
    for (const a of AWARDS) expect(a.description.length).toBeGreaterThan(20)
    for (const s of pastSeasonAwards()) for (const a of s.awards) expect(a.description.length).toBeGreaterThan(10)
  })

  it("sets MVP (the whole season, attendance included) apart from Best Player (peak ability)", () => {
    expect(AWARD_TEXT.mvp).toMatch(/attendance counts/i)
    expect(AWARD_TEXT["best-player"]).toMatch(/attendance does not count/i)
    expect(AWARD_TEXT["best-player"]).toMatch(/peak/i)
  })

  it("keeps to the site's writing rules", () => {
    for (const t of Object.values(AWARD_TEXT)) {
      expect(t).not.toMatch(/—/)
      expect(t).not.toMatch(/\bworst\b/i)
    }
  })
})
