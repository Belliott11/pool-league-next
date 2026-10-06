import { describe, expect, it } from "vitest"
import { applyPronouns } from "@/lib/pronouns"

describe("pronouns", () => {
  it("leaves a line alone when nothing is chosen", () => {
    expect(applyPronouns("Pick them last until they prove otherwise.", undefined)).toBe("Pick them last until they prove otherwise.")
  })

  it("switches pronouns and fixes the verbs", () => {
    expect(applyPronouns("Pick them last until they prove otherwise.", "he")).toBe("Pick him last until he proves otherwise.")
    expect(applyPronouns("They are 1-4 and their usual is 7, which they know.", "she")).toBe("She is 1-4 and her usual is 7, which she knows.")
    expect(applyPronouns("It was them, and they were wrong.", "he")).toBe("It was him, and he was wrong.")
  })

  it("does not touch 'of them', which is about things, not the player", () => {
    expect(applyPronouns("A lot of them were tired ones, and they will say so.", "she")).toBe("A lot of them were tired ones, and she will say so.")
  })
})
