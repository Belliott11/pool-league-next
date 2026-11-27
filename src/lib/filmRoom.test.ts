import { describe as group, expect, it } from "vitest"
import type { PlayValue } from "./epa"
import { describe, takeaways } from "./filmRoom"

const play = (o: Partial<PlayValue>): PlayValue => ({
  gameId: "g", date: "2027-06-01", id: Math.random().toString(36), kind: "shot", t: 10, side: 0, player: "z", passer: null, defenders: [], forcer: null,
  points: 2, made: true, end: "made", value: 1.4, contest: null, shotType: null, catchAndShoot: null, rebounder: null, blocker: null, spot: null, ...o,
})
const name = (p: string) => ({ z: "Zach", b: "Ben", i: "Ian" })[p] ?? p

group("film room", () => {
  it("describes plays in plain words", () => {
    expect(describe(play({ points: 3, passer: "b", defenders: ["i"], contest: "beat" }), name)).toBe("Zach hits a 3 off Ben's pass after getting past Ian.")
    expect(describe(play({ shotType: "drive", made: false, end: "lost", defenders: ["i"], contest: "heavy", rebounder: "i" }), name)).toBe("Zach misses on the drive with Ian all over it. Ian grabs the board.")
    expect(describe(play({ kind: "turnover", forcer: "i", end: null }), name)).toBe("Ian picks off Zach.")
  })
  it("finds the kinds of shots that went in most and least", () => {
    const shots = [
      ...Array.from({ length: 5 }, () => play({ shotType: "drive", made: true })),
      ...Array.from({ length: 5 }, () => play({ shotType: "deepHeave", points: 3, made: false, end: "out" })),
    ]
    const t = takeaways(shots, 3)
    expect(t.best?.label).toBe("drives")
    expect(t.best?.pps).toBe(2)
    expect(t.worst?.pps).toBe(0)
  })
  it("says nothing when the kinds are close or too few", () => {
    expect(takeaways([play({ shotType: "drive" }), play({ shotType: "move" })], 3)).toEqual({ best: null, worst: null })
  })
})

group("play sentences", () => {
  it("tells blocks, out of bounds and open shots plainly", () => {
    expect(describe(play({ shotType: "drive", made: false, end: "lost", blocker: "i" }), name)).toBe("Ian blocks Zach's drive.")
    expect(describe(play({ points: 3, made: false, end: "out", contest: "none" }), name)).toBe("Zach misses a 3 wide open. It goes out of bounds.")
    expect(describe(play({ shotType: "dunk", defenders: ["i"], contest: "heavy" }), name)).toBe("Zach dunks it over Ian.")
    expect(describe(play({ points: 3, shotType: "deepHeave", made: false, end: "kept", rebounder: "b" }), name)).toBe("Zach misses a deep heave. Ben keeps it alive.")
  })
})

group("no doubled words", () => {
  it("drops 'off the catch' when the pass is named", () => {
    expect(describe(play({ shotType: "catchAndShoot", passer: "b" }), name)).toBe("Zach hits a 2 off Ben's pass.")
  })
})
