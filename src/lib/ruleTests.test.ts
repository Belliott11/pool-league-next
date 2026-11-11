import { describe, expect, it } from "vitest"
import { adviceFrom, coinP, lateLeads, pickOf, picksFor, ruleTests, stratified, verdictFromWins, type Rule } from "@/lib/ruleTests"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const base = { stats: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const close = { x: 50, y: 10 }
const far = { x: 50, y: 60 }
const shot = (id: string, scorerId: string, made: boolean, t: number, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId, points: 2, made, videoTime: t, shotLocation: close, contestLevel: "none", passerId: "none", ...extra })
const state = (games: Game[]): PooleanState => ({ players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games })
const rule = (rs: Rule[], id: string) => rs.find((r) => r.id === id)!
const stats = (a: number, b: number) => [{ playerId: "a", pts: a, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }, { playerId: "b", pts: b, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }]
const game = (id: string, date: string, ev: ScoringEvent[]): Game => ({ ...base, id, date, teamA: ["a"], teamB: ["b"], winner: "A", stats: stats(4, 2), scoringEvents: ev })

describe("verdicts", () => {
  it("computes an exact coin-flip test", () => {
    expect(coinP(5, 10)).toBeCloseTo(1, 6)
    expect(coinP(10, 10)).toBeCloseTo(2 / 1024, 6)
  })
  it("stays Too early on small samples, even when lopsided", () => {
    expect(verdictFromWins(7, 8).verdict).toBe("early")
    expect(verdictFromWins(11, 17).verdict).toBe("early")
  })
  it("needs a real sample for No sign of it", () => {
    expect(verdictFromWins(26, 56).verdict).toBe("none")
  })
  it("calls a clear result either way", () => {
    expect(verdictFromWins(30, 30)).toEqual({ verdict: "holds", strength: "clear" })
    expect(verdictFromWins(0, 30)).toEqual({ verdict: "backwards", strength: "clear" })
  })
})

describe("holding the zone constant", () => {
  // Open shots look worse overall because they are mostly far away, but from the same spot they are better.
  const r = (made: number, att: number) => ({ made, att })
  it("flips a result the mix of shots created", () => {
    // Near: open 9/10, guarded 50/100. Far: open 10/100, guarded 0/10. Open is worse overall and better in both zones.
    const groups: [ReturnType<typeof r>, ReturnType<typeof r>][] = [[r(9, 10), r(50, 100)], [r(10, 100), r(0, 10)]]
    expect(19 / 110).toBeLessThan(50 / 110)
    expect(stratified(groups).diff!).toBeGreaterThan(0)
  })
  it("says Too early with nothing to compare", () => {
    expect(stratified([[r(1, 2), r(0, 0)]]).verdict).toBe("early")
  })
})

describe("rules on games", () => {
  const ev = [shot("1", "a", true, 0), shot("2", "b", false, 5, { rebounderId: "a", points: 3, shotLocation: far }), shot("3", "a", true, 10), shot("4", "b", true, 20)]
  const g = game("g", "2026-08-01", ev)
  const rs = ruleTests(state([g]), [])
  it("has every rule, and calls them all too early on one game", () => {
    expect(rs.length).toBeGreaterThanOrEqual(15)
    expect(rs.every((r) => r.verdict === "early")).toBe(true)
    expect(adviceFrom(rs)).toEqual([])
  })
  it("measures twos against threes", () => {
    expect(rule(rs, "moreyball").numbers).toBe("Twos 2.00 points a shot, threes 0.00")
  })
  it("finds the first basket and the halfway leader", () => {
    expect(rule(rs, "first-score").numbers).toBe("First to score won 1 of 1")
  })
  it("gives advice only for a real verdict", () => {
    const fake: Rule[] = [
      { id: "a", sport: "", claim: "", numbers: "", n: "", verdict: "holds", strength: "hint", advice: "do it" },
      { id: "b", sport: "", claim: "", numbers: "", n: "", verdict: "early", strength: null, advice: "no" },
      { id: "c", sport: "", claim: "", numbers: "", n: "", verdict: "holds", strength: "hint" },
    ]
    expect(adviceFrom(fake).map((r) => r.id)).toEqual(["a"])
  })
})

describe("contest levels", () => {
  const ev: ScoringEvent[] = []
  for (let i = 0; i < 30; i++) ev.push(shot(`l${i}`, "a", i < 25, i, { contestLevel: "light", defenderIds: ["b"] }))
  for (let i = 0; i < 30; i++) ev.push(shot(`h${i}`, "a", i < 5, 100 + i, { contestLevel: "heavy", defenderIds: ["b"], rebounderId: "b" }))
  for (let i = 0; i < 30; i++) ev.push(shot(`o${i}`, "a", i < 15, 200 + i, { rebounderId: "b" }))
  const rs = ruleTests(state([game("g", "2026-08-01", ev)]), [])
  it("keeps light contests out of the open-shot test", () => {
    expect(rule(rs, "open-shots").numbers).toContain("Wide open 50%, medium or heavy contest 17%")
  })
  it("tests beating your defender on its own, for the same shooter and zone", () => {
    expect(rule(rs, "defensive-breakdown").verdict).toBe("holds")
    expect(rule(rs, "defensive-breakdown").numbers).toContain("Light contest or got beat 83%")
  })
})

describe("results rules", () => {
  it("counts the bigger team on uneven games, whichever side won", () => {
    const old = [
      { n: 1, date: "2026-06-01", a: ["a", "c"], b: ["b"], w: "A" as const },
      { n: 2, date: "2026-06-02", a: ["b"], b: ["a", "c"], w: "A" as const },
    ]
    expect(rule(ruleTests(state([]), old), "power-play").numbers).toBe("Bigger team won 1 of 2")
  })
  it("finds rematches", () => {
    const old = [
      { n: 1, date: "2026-06-01", a: ["a"], b: ["b"], w: "A" as const },
      { n: 2, date: "2026-06-01", a: ["b"], b: ["a"], w: "B" as const },
    ]
    expect(rule(ruleTests(state([]), old), "rematch").numbers).toBe("Same winner 1 of 1")
  })
})

describe("a game's pick", () => {
  const g1 = game("g1", "2026-08-01", [shot("1", "a", true, 0)])
  const g2 = game("g2", "2026-08-01", [shot("2", "a", true, 0)])
  const s = state([g1, g2])
  it("is captains by default, and a runback when the same teams already played that day", () => {
    expect(pickOf(s, g1)).toEqual({ method: "captains", tagged: false })
    expect(pickOf(s, g2)).toEqual({ method: "runback", tagged: false })
  })
  it("uses the tag when there is one", () => {
    expect(pickOf(s, { ...g2, teamsPickedBy: "random" })).toEqual({ method: "random", tagged: true })
  })
})

describe("team picks", () => {
  const r = (night: string, a: string[], b: string[]) => ({ a, b, aWon: true, night })
  it("is captains, unless the same teams already played that day", () => {
    const all = [r("d1", ["a"], ["b"]), r("d1", ["c"], ["b"]), r("d1", ["b"], ["a"]), r("d2", ["a"], ["b"])]
    expect(picksFor(state([]), all)).toEqual(["captains", "captains", "runback", "captains"])
  })
  it("uses what a game was tagged with", () => {
    const g = { ...game("g", "d1", [shot("1", "a", true, 0)]), teamsPickedBy: "random" as const }
    expect(picksFor(state([g]), [r("d1", ["b"], ["a"])])).toEqual(["random"])
  })
})

describe("late leads", () => {
  const ev = (id: string, scorerId: string, points: 1 | 2 | 3, t: number): ScoringEvent => ({ id, scorerId, points, made: true, videoTime: t })
  const g = (evs: ScoringEvent[]): Game => ({ id: "l", date: "d", teamA: ["a"], teamB: ["b"], winner: "A", liveTarget: 11, stats: [], scoringEvents: evs, turnoverEvents: [], stealEvents: [], foulEvents: [] })
  it("finds the first time a team is up 3 or more within 4 of the target, and whether they held on", () => {
    // a reaches 7 to 2 (4 to go, up 5), then b comes back and wins 11 to 9.
    const comeback = g([ev("1", "a", 3, 1), ev("2", "a", 2, 2), ev("3", "b", 2, 3), ev("4", "a", 2, 4), ev("5", "b", 3, 5), ev("6", "b", 3, 6), ev("7", "a", 2, 7), ev("8", "b", 3, 8)])
    const held = g([ev("1", "a", 3, 1), ev("2", "a", 2, 2), ev("3", "a", 2, 3), ev("4", "b", 2, 4), ev("5", "a", 2, 5), ev("6", "a", 2, 6)])
    expect(lateLeads([comeback, held])).toEqual({ held: 1, n: 2 })
  })
})
