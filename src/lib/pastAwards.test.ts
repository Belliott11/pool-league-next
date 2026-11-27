import { describe, expect, it } from "vitest"
import { pastSeasonAwards } from "@/lib/pastAwards"

describe("last season's voted awards", () => {
  const s = pastSeasonAwards()[0]
  const award = (k: string) => s.awards.find((a) => a.key === k)!

  it("reads Summer 2026 with all eleven awards, MVP first", () => {
    expect(s.season).toBe("Summer 2026")
    expect(s.awards).toHaveLength(11)
    expect(s.awards[0].key).toBe("mvp")
    expect(award("mvp").winners).toEqual(["ben"])
    expect(award("mvp").standings[0]).toEqual({ ids: ["ben"], points: 18 })
  })

  it("splits the combined team vote into first and second team", () => {
    expect(award("first-team").standings.map((x) => x.ids[0])).toEqual(["phillip", "ben", "sean"])
    expect(award("second-team").standings.map((x) => x.ids[0])).toEqual(["adam", "reilly", "evan"])
    expect(award("second-team").winners).toEqual(["adam", "reilly", "evan"])
  })

  it("marks the awards a tie decided, and keeps duos as pairs", () => {
    expect(award("dpoy").tieWon).toBe(true) // Adam and Jason 9 each
    // Zach and Phillip 7 each; Poolean gave it to Zach on attendance (15 parties to 4), the winner announced.
    expect(award("clutch").winners).toEqual(["zach"])
    expect(award("clutch").standings[0].ids).toEqual(["zach"])
    expect(award("mvp").tieWon).toBe(false)
    expect(award("best-duo").standings[0].ids).toEqual(["ben", "phillip"])
    expect(award("worst-duo").label).not.toMatch(/worst/i)
  })
})
