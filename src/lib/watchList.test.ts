import { describe, expect, it } from "vitest"
import { earlyRanking } from "@/lib/offseason"
import { EMPTY_OLD, type OldSite } from "@/lib/oldSite"
import type { Game, PlayerGameStats, PooleanState } from "@/lib/types"
import { watchList } from "@/lib/watchList"

const line = (playerId: string, pts: number): PlayerGameStats => ({ playerId, pts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 })
// A box-scored game of x and y against z and w. The one logged shot is by a ghost, so each player's two-way is just points.
const game = (n: number, pts: Record<string, number>, ids = ["x", "y", "z", "w"]): Game => ({
  id: `g${n}`,
  date: `2026-07-${String(n + 1).padStart(2, "0")}`,
  teamA: ids.slice(0, 2),
  teamB: ids.slice(2),
  stats: ids.map((id) => line(id, pts[id])),
  scoringEvents: [{ id: `e${n}`, scorerId: "ghost", points: 1 }],
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
})
const state = (games: Game[]): PooleanState => ({ players: ["x", "y", "z", "w"].map((id) => ({ id, name: id })), games })
const six = [
  ...[0, 1, 2].map((n) => game(n, { x: 2, y: 8, z: 4, w: 1 })),
  ...[3, 4, 5].map((n) => game(n, { x: 8, y: 2, z: 4, w: 1 })),
]
const old = (o: Partial<OldSite>): OldSite => ({ ...EMPTY_OLD, ...o })
const ids = (xs: { id: string }[]) => xs.map((r) => r.id)

describe("players to watch", () => {
  it("lists who rose late, and who cooled off but was strong over the whole season", () => {
    const w = watchList(state(six), 3, EMPTY_OLD)
    expect(w.rated).toBe(4)
    expect(ids(w.rising)).toEqual(["x"])
    expect(w.rising[0].signals[0]).toMatchObject({ kind: "twoWay", n: 6 })
    expect(w.rising[0].signals[0].late - w.rising[0].signals[0].early).toBeCloseTo(8, 5)
    expect(ids(w.bounce)).toEqual(["y"])
  })

  it("leaves out a cooled-off player whose whole season was weak", () => {
    const weak = [...[0, 1, 2].map((n) => game(n, { x: 8, y: 4, z: 3, w: 0 })), ...[3, 4, 5].map((n) => game(n, { x: 8, y: 4, z: 0, w: 3 }))]
    const w = watchList(state(weak), 3, EMPTY_OLD)
    expect(w.bounce).toEqual([])
    expect(ids(w.rising)).toEqual(["w"])
  })

  it("needs 4 games, and falls back to points for games with no box score", () => {
    expect(watchList(state(six.slice(0, 3)), 3, EMPTY_OLD).rated).toBe(0)
    const noBox = six.map((g) => ({ ...g, scoringEvents: [], liveScores: [{ pid: g.teamA[0], points: g.stats[0].pts + g.stats[1].pts }, { pid: g.teamB[0], points: g.stats[2].pts + g.stats[3].pts }] }))
    const w = watchList(state(noBox), 3, EMPTY_OLD)
    expect(w.rated).toBeGreaterThan(0)
    for (const r of [...w.rising, ...w.bounce]) expect(r.signals.every((s) => s.kind === "scoring")).toBe(true)
  })

  it("uses the old site's results and power rankings for players with no filmed games", () => {
    const o = old({
      wins: new Map([["x", [false, false, false, false, true, true, true, true]]]),
      ranks: new Map([["y", [80, 75, 40, 30]]]),
      power: new Map([["y", 70]]),
    })
    const w = watchList(state([]), 3, o)
    expect(ids(w.rising)).toEqual(["x"])
    expect(w.rising[0].signals[0]).toMatchObject({ kind: "wins", early: 0, late: 1 })
    expect(ids(w.bounce)).toEqual(["y"])
    expect(w.bounce[0].signals[0]).toMatchObject({ kind: "power", early: 77.5, late: 35 })
  })

  it("skips a player whose signals disagree", () => {
    const o = old({ wins: new Map([["x", [false, false, false, false, true, true, true, true]]]), ranks: new Map([["x", [90, 90, 30, 30]]]), power: new Map([["x", 60]]) })
    const w = watchList(state([]), 3, o)
    expect(w.rising).toEqual([])
    expect(w.bounce).toEqual([])
  })
})

describe("early ranking with the old site", () => {
  it("ranks a player with only old-site data, and averages it with the box score when both exist", () => {
    const o = old({ power: new Map([["z", 90], ["x", 20]]), ranks: new Map([["z", [90, 90, 90]]]) })
    const r = earlyRanking(state(six), o)
    // x and y, z, w have box data (y best, then x tied with z by two-way). z also has old power 90 so it rises.
    expect(r[0].id).toBe("z")
    expect(r.find((p) => p.id === "x")?.oldPower).toBe(20)
    expect(earlyRanking(state([]), o).map((p) => p.id)).toEqual(["z", "x"])
  })
})
