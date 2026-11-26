import { describe, expect, it } from "vitest"
import { cancelLottery, drawOrder, lotteryLive, pickOdds, revealNext, runLottery, shownPicks } from "./draftLottery"
import type { SeasonTeamSet } from "./types"

const set = {
  id: "s",
  from: "2027-06-01",
  drafting: true,
  teams: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), color: "#000", captain: `cap-${id}`, members: [`cap-${id}`] })),
} as SeasonTeamSet

describe("draft lottery", () => {
  it("draws every team once, weighted by balls", () => {
    const order = drawOrder({ a: 4, b: 3, c: 2, d: 1 }, () => 0)
    expect(order).toEqual(["a", "b", "c", "d"]) // the lowest draw always lands on the first ball left
    expect(new Set(drawOrder({ a: 1, b: 1, c: 1 })).size).toBe(3)
  })
  it("works out each team's exact odds", () => {
    const o = pickOdds({ a: 4, b: 3, c: 2, d: 1 })
    expect(o.a[0]).toBeCloseTo(0.4)
    expect(o.d[0]).toBeCloseTo(0.1)
    for (const id of ["a", "b", "c", "d"]) expect(o[id].reduce((x, y) => x + y, 0)).toBeCloseTo(1)
    for (let k = 0; k < 4; k++) expect(["a", "b", "c", "d"].reduce((x, id) => x + o[id][k], 0)).toBeCloseTo(1)
    expect(pickOdds({ a: 1, b: 1 }).a).toEqual([0.5, 0.5])
  })
  it("reveals from the last pick and only reorders the teams at the end", () => {
    let s = runLottery(set, "even", undefined, () => 0.99)
    const order = s.lottery!.order
    expect(lotteryLive(s)).toBe(true)
    s = revealNext(s)
    expect(shownPicks(s.lottery!)).toEqual([{ pick: 4, id: order[3] }])
    expect(s.teams.map((t) => t.id)).toEqual(["a", "b", "c", "d"])
    s = revealNext(revealNext(revealNext(s)))
    expect(lotteryLive(s)).toBe(false)
    expect(s.teams.map((t) => t.id)).toEqual(order)
    expect(revealNext(s)).toBe(s)
  })
  it("can be called off", () => {
    expect(cancelLottery(runLottery(set, "weighted")).lottery).toBeUndefined()
  })
})
