import { describe, expect, it } from "vitest"
import { adviseMatchups, profiles } from "@/lib/matchupAdvice"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// Four players, two a side. d1 is solid (opponents shoot poorly, never beaten), d2 gets beat a lot. s1 is the efficient scorer who
// lives at the rim, s2 takes few shots.
const ev = (id: string, scorer: string, defender: string, made: boolean, level: ScoringEvent["contestLevel"], at: { x: number; y: number } = { x: 50, y: 10 }): ScoringEvent => ({ id, scorerId: scorer, points: 2, made, contestLevel: level, defenderIds: [defender], shotLocation: at, videoTime: 1 })
const events: ScoringEvent[] = []
let n = 0
for (let i = 0; i < 12; i++) events.push(ev("a" + n++, "s1", "d1", i < 3, "heavy")) // s1 against the solid defender: 25%
for (let i = 0; i < 12; i++) events.push(ev("a" + n++, "s1", "d2", i < 8, i < 6 ? "beat" : "light")) // against the one who gets beat: scores a lot
for (let i = 0; i < 4; i++) events.push(ev("a" + n++, "s2", "d1", i < 1, "medium", { x: 50, y: 70 }))
for (let i = 0; i < 12; i++) events.push(ev("a" + n++, "t1", "d2", i < 6, i < 4 ? "beat" : "light"))
for (let i = 0; i < 4; i++) events.push(ev("a" + n++, "t2", "d1", i < 2, "medium"))
const game: Game = { id: "g", date: "2026-08-10", teamA: ["d1", "d2"], teamB: ["s1", "s2"], stats: [], scoringEvents: events, turnoverEvents: [], stealEvents: [], foulEvents: [] }
const state = (games: Game[]): PooleanState => ({ players: [], games })

describe("matchup advice", () => {
  const p = profiles(state([game]))
  it("reads the defenders from beat rate and opponent FG% without beat shots", () => {
    expect(p.defenders.get("d2")!.beatRate).toBeGreaterThan(p.defenders.get("d1")!.beatRate)
    expect(p.defenders.get("d1")!.weak).toBeLessThan(p.defenders.get("d2")!.weak)
  })
  it("reads the scorers from efficiency without breakdown shots, rim share and usage", () => {
    expect(p.scorers.get("s1")!.rimShare).toBe(1)
    expect(p.scorers.get("s2")!.rimShare).toBe(0)
    expect(p.scorers.get("s1")!.usage).toBe(1)
  })
  it("puts the strongest defender on the most efficient scorer and the one who gets beat on the quiet scorer", () => {
    const a = adviseMatchups(state([game]), ["d1", "d2"], ["s1", "s2"])[0]
    const guard = (s: string) => a.list.find((x) => x.scorer.id === s)!.defender.id
    expect(guard("s1")).toBe("d1")
    expect(guard("s2")).toBe("d2")
  })
  it("fades a line when either player has under 3 games, and lets a defender on the smaller team cover two", () => {
    expect(adviseMatchups(state([game]), ["d1", "d2"], ["s1", "s2"])[0].list.every((x) => x.thin)).toBe(true)
    const covers = adviseMatchups(state([game]), ["d1"], ["s1", "s2"])[0].list
    expect(covers).toHaveLength(2)
    expect(covers.every((x) => x.defender.id === "d1")).toBe(true)
  })
})
