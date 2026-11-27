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
    expect(describe(play({ points: 3, passer: "b", defenders: ["i"], contest: "beat" }), name)).toBe("Zach from deep, off Ben's pass, got past Ian: good.")
    expect(describe(play({ shotType: "drive", made: false, end: "lost", defenders: ["i"], contest: "heavy", rebounder: "i" }), name)).toBe("Zach on the drive, Ian all over it: missed, Ian with the board.")
    expect(describe(play({ kind: "turnover", forcer: "i", end: null }), name)).toBe("Zach turned it over, picked off by Ian.")
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
