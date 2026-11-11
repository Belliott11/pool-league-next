import { describe, expect, it } from "vitest"
import { scoutCard, type Metrics } from "@/lib/scouting"

const m = (id: string, o: Partial<Metrics> = {}): Metrics => ({
  id,
  games: 8,
  shots: 60,
  pts: 10,
  reb: 3,
  ast: 2,
  stl: 1,
  blk: 0,
  liveTov: 1.5,
  fg: 0.4,
  rimFg: 0.5,
  lineFg: 0.3,
  deepFg: 0.2,
  rimShare: 0.3,
  lineShare: 0.2,
  deepShare: 0.1,
  beatRate: 0.2,
  oppFg: 0.4,
  fgNoBeat: 0.38,
  beatShare: 0.1,
  ...o,
})

const league = [m("a"), m("b", { pts: 9 }), m("c", { pts: 11 }), m("d", { pts: 12 }), m("e", { pts: 8 })]

describe("scouting card", () => {
  it("lists what sits well above and below the league's middle, in the right direction for each stat", () => {
    const me = m("me", { pts: 20, liveTov: 4, rimFg: 0.9 })
    const c = scoutCard([...league, me], "me")!
    expect(c.strengths.map((l) => l.label)).toContain("Scoring")
    expect(c.strengths.map((l) => l.label)).toContain("Finishing at the rim")
    expect(c.workOn.map((l) => l.label)).toContain("Live-ball turnovers") // lower is better, so a high number is a gap
    expect(c.strengths.map((l) => l.label)).not.toContain("Live-ball turnovers")
  })
  it("builds how to guard from shot habits and the make rate when the defender is not beaten", () => {
    const me = m("me", { rimShare: 0.7, rimFg: 0.8, fgNoBeat: 0.6 })
    const g = scoutCard([...league, me], "me")!.guard.join(" ")
    expect(g).toContain("70% of their shots are at the rim")
    expect(g).toContain("contest every shot")
    const low = scoutCard([...league, m("me", { fgNoBeat: 0.2 })], "me")!.guard.join(" ")
    expect(low).toContain("stay in front")
  })
  it("marks an early read under 5 games or 20 shots, and never gives one grade", () => {
    expect(scoutCard([...league, m("me", { games: 4 })], "me")!.sample.early).toBe(true)
    expect(scoutCard([...league, m("me", { shots: 19 })], "me")!.sample.early).toBe(true)
    const full = scoutCard([...league, m("me")], "me")!
    expect(full.sample.early).toBe(false)
    expect(Object.keys(full).sort()).toEqual(["guard", "sample", "strengths", "workOn"])
  })
  it("returns nothing for a player with no games", () => {
    expect(scoutCard(league, "nobody")).toBeNull()
  })
})
