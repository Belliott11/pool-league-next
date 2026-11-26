import { describe, expect, it } from "vitest"
import { nbaComps } from "./nbaComps"
import type { Metrics } from "./scouting"

const m = (id: string, o: Partial<Metrics>): Metrics => ({
  id, games: 5, shots: 30, pts: 4, reb: 2, ast: 1, stl: 0.5, blk: 0.2, liveTov: 1, fg: 0.45, rimFg: null, lineFg: null, deepFg: null,
  rimShare: 0.3, lineShare: 0.2, deepShare: 0.05, beatRate: null, oppFg: null, fgNoBeat: 0.45, beatShare: 0.1, ...o,
})

describe("nbaComps", () => {
  const all = [
    m("shooter", { lineShare: 0.6, deepShare: 0.2, rimShare: 0.05, pts: 7, fgNoBeat: 0.55 }),
    m("passer", { ast: 3.5, pts: 2, lineShare: 0.1, deepShare: 0 }),
    m("big", { reb: 6, rimShare: 0.8, lineShare: 0, deepShare: 0 }),
    m("mid", {}),
    m("mid2", { pts: 4.2 }),
  ]
  const c = nbaComps(all)
  it("matches styles and says why", () => {
    expect(c.get("shooter")?.why).toContain("lives behind the line")
    expect(c.get("passer")?.why).toContain("sets everyone up")
    expect(c.get("big")?.why).toMatch(/glass|rim/)
  })
  it("gives no two strong styles the same name", () => {
    const names = ["shooter", "passer", "big"].map((id) => c.get(id)?.name)
    expect(new Set(names).size).toBe(3)
  })
  it("needs enough games and shots", () => {
    expect(nbaComps(all.map((x) => ({ ...x, games: 2 }))).size).toBe(0)
  })
})
