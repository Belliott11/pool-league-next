import { describe, expect, it } from "vitest"
import { FACTORS, marginBreakdown, passBlame, shotsCreated, shotZone, turnoverCost, winChance, winProbAdded, yardstick } from "@/lib/insight"
import { PER } from "@/lib/per"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// A (a1, a2) beats B (b1) 8 to 4 on shots. a2 passes to a1 twice (one assisted make, one miss); b1 turns it over once and a1's
// shot straight after is made.
const shot = (id: string, scorerId: string, points: 2 | 3, made: boolean, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId, points, made, shotType: "drive", contestLevel: "none", ...extra })
const events: ScoringEvent[] = [
  shot("e1", "a1", 2, true, { passerId: "a2", assistId: "a2", videoTime: 1 }),
  shot("e2", "b1", 2, true, { passerId: "none", videoTime: 2 }),
  shot("e3", "a1", 2, false, { passerId: "a2", videoTime: 3 }),
  shot("e4", "a2", 2, true, { passerId: "none", videoTime: 4, defenderIds: ["b1"] }),
  shot("e5", "b1", 2, true, { passerId: "none", videoTime: 5 }),
  shot("e6", "a1", 2, true, { passerId: "none", videoTime: 6, defenderIds: ["b1"] }),
  shot("e7", "a1", 2, true, { passerId: "none", videoTime: 7 }),
]
const game: Game = {
  id: "g",
  date: "2026-07-01",
  teamA: ["a1", "a2"],
  teamB: ["b1"],
  stats: [
    { playerId: "a1", pts: 6, oreb: 1, dreb: 0, ast: 0, stl: 1, blk: 0, tov: 0, pf: 0 },
    { playerId: "a2", pts: 2, oreb: 0, dreb: 0, ast: 1, stl: 0, blk: 0, tov: 0, pf: 0 },
    { playerId: "b1", pts: 4, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 1, pf: 0 },
  ],
  scoringEvents: events,
  turnoverEvents: [{ id: "t1", playerId: "b1", opponentId: "a1", videoTime: 5.5 }],
  stealEvents: [],
  foulEvents: [],
}
const state: PooleanState = { players: [{ id: "a1", name: "A1" }, { id: "a2", name: "A2" }, { id: "b1", name: "B1" }], games: [game] }

describe("margin breakdown", () => {
  const b = marginBreakdown(state)
  it("splits the margin into parts that add back to it", () => {
    expect(b.games).toBe(1)
    expect(b.margin).toBe(4)
    expect(FACTORS.reduce((n, f) => n + b.edge[f], 0)).toBeCloseTo(4, 6)
  })
  it("describes a player's own side, not the winner's", () => {
    const loser = marginBreakdown(state, "b1")
    expect(FACTORS.reduce((n, f) => n + loser.edge[f], 0)).toBeCloseTo(-4, 6)
  })
})

describe("shots created", () => {
  const c = shotsCreated(state)
  const a2 = c.rows.find((r) => r.id === "a2")!
  it("counts every pass to a shot, made or missed", () => {
    expect(a2.created).toBe(2)
    expect(a2.made).toBe(1)
    expect(a2.assists).toBe(1)
    expect(a2.created25).toBeCloseTo((2 / 12) * PER, 6)
  })
  it("compares passed shots with the rest", () => {
    expect(c.league.passed).toBe(2)
    expect(c.league.passedFg).toBe(0.5)
  })
})

describe("win probability added", () => {
  it("is a coin flip when tied with a lot left, and near certain when far ahead late", () => {
    expect(winChance(0, 20, 4)).toBeCloseTo(0.5, 6)
    expect(winChance(10, 2, 4)).toBeGreaterThan(0.99)
  })
  const w = winProbAdded(state)
  it("gives the winning basket the rest of the win and shares assisted baskets", () => {
    expect(w.swings.some((s) => s.to === 1)).toBe(true)
    const a1 = w.rows.find((r) => r.id === "a1")!
    const a2 = w.rows.find((r) => r.id === "a2")!
    expect(a1.added).toBeGreaterThan(0)
    expect(a2.added).toBeGreaterThan(0)
  })
  it("debits the defenders of baskets scored against them", () => {
    expect(w.rows.find((r) => r.id === "b1")!.allowed).toBeGreaterThan(0)
  })
})

describe("turnover cost", () => {
  const t = turnoverCost(state)
  it("values a possession as points over shots minus rebounds plus turnovers", () => {
    expect(t.possessions).toBe(7 - 1 + 1)
    expect(t.perPossession).toBeCloseTo(12 / 7, 6)
  })
  it("measures points straight after turnovers and credits who forced them", () => {
    expect(t.perTurnover).toBe(2)
    expect(t.rows.find((r) => r.id === "b1")!.handed).toBe(2)
    expect(t.rows.find((r) => r.id === "a1")!.taken).toBe(2)
    expect(t.rows.find((r) => r.id === "a1")!.forced).toBe(1)
  })
})

describe("a blocked shot that goes out with the ball kept", () => {
  it("extends the possession like an offensive rebound", () => {
    const out: Game = { ...game, scoringEvents: [...events, shot("e9", "a1", 3, false, { blockerId: "b1", passerId: "none", videoTime: 9 })] }
    expect(turnoverCost({ ...state, games: [out] }).possessions).toBe(turnoverCost(state).possessions)
  })
})

describe("shot-based turnovers", () => {
  // The same game plus a blocked shot by b1 logged as a miss and a turnover.
  const blocked: Game = {
    ...game,
    scoringEvents: [...events, shot("e8", "b1", 2, false, { passerId: "none", videoTime: 8, turnoverEventId: "t2" })],
    turnoverEvents: [...game.turnoverEvents, { id: "t2", playerId: "b1", videoTime: 8 }],
  }
  const s: PooleanState = { ...state, games: [blocked] }
  it("are not counted again as possessions or giveaways", () => {
    const t = turnoverCost(s)
    expect(t.possessions).toBe(8 - 1 + 1)
    expect(t.turnovers).toBe(1)
    expect(t.rows.find((r) => r.id === "b1")!.giveaways).toBe(1)
  })
  it("leave the margin parts adding up", () => {
    expect(FACTORS.reduce((n, f) => n + marginBreakdown(s).edge[f], 0)).toBeCloseTo(4, 6)
  })
})

describe("player breakdowns", () => {
  it("gives each side of a game opposite signs that add to the same parts", async () => {
    const { playerBreakdowns } = await import("@/lib/insight")
    const rows = playerBreakdowns(state)
    const a1 = rows.find((r) => r.id === "a1")!
    const b1 = rows.find((r) => r.id === "b1")!
    expect(a1.margin).toBe(4)
    expect(b1.margin).toBe(-4)
    for (const f of FACTORS) expect(a1.edge[f]).toBeCloseTo(-b1.edge[f], 6)
  })
})

describe("shot quality yardstick", () => {
  const at = (x: number, y: number) => ({ shotLocation: { x, y } })
  const g = (evs: ScoringEvent[]): Game => ({ id: "y", date: "d", teamA: ["a"], teamB: ["b"], winner: "A", stats: [], scoringEvents: evs, turnoverEvents: [], stealEvents: [], foulEvents: [] })
  it("uses where the shot was taken, falling back from type and contest to contest to zone to the league", () => {
    // Five made close drives and five missed mid drives, all open: the same type and contest, so only the spot separates them.
    const close = [1, 2, 3, 4, 5].map((i) => shot(`c${i}`, "a", 2, true, at(50, 10)))
    const mid = [1, 2, 3, 4, 5].map((i) => shot(`m${i}`, "a", 2, false, at(50, 50)))
    const expect_ = yardstick([g([...close, ...mid])])
    expect(expect_(shot("q1", "a", 2, false, at(50, 12)))).toBe(2) // close, open drive: its own group
    expect(expect_(shot("q2", "a", 2, false, at(50, 55)))).toBe(0) // mid, open drive
    expect(expect_(shot("q3", "a", 2, false, { ...at(50, 12), shotType: "fadeaway" }))).toBe(2) // no fadeaways yet: contest and zone
    expect(expect_(shot("q4", "a", 2, false, { ...at(50, 12), shotType: "fadeaway", contestLevel: "heavy" }))).toBe(2) // zone alone
    expect(expect_(shot("q5", "a", 3, false, at(50, 90)))).toBe(1) // a deep three nobody has taken: the league's 1 point a shot
  })
  it("bands shots like the shot charts", () => {
    expect(shotZone(shot("z", "a", 2, true, at(50, 10)))).toBe("close")
    expect(shotZone(shot("z", "a", 3, true, at(50, 90)))).toBe("deep")
    expect(shotZone(shot("z", "a", 2, true))).toBe("?")
  })
})

describe("catch and shoot", () => {
  const g = (evs: ScoringEvent[]): Game => ({ id: "c", date: "d", teamA: ["a", "p"], teamB: ["b"], winner: "A", stats: [], scoringEvents: evs, turnoverEvents: [], stealEvents: [], foulEvents: [] })
  it("puts a contest on the passer when it was shot on the catch, and on the shooter when they held it", () => {
    const st = { players: [], games: [g([
      shot("1", "a", 2, false, { passerId: "p", catchAndShoot: true, contestLevel: "heavy" }),
      shot("2", "a", 2, true, { passerId: "p", assistId: "p", catchAndShoot: true, contestLevel: "none" }),
      shot("3", "a", 2, false, { passerId: "p", catchAndShoot: false, contestLevel: "medium" }),
      shot("4", "a", 2, false, { passerId: "p" }), // untagged: left out
    ])] }
    const rows = passBlame(st)
    expect(rows.find((r) => r.id === "p")).toMatchObject({ passes: 2, passesContested: 1 })
    expect(rows.find((r) => r.id === "a")).toMatchObject({ held: 1, heldContested: 1 })
  })
})
