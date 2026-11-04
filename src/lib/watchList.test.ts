import { describe, expect, it } from "vitest"
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

describe("players to watch", () => {
  it("lists who rose late, and who cooled off but was strong over the whole season", () => {
    const w = watchList(state(six))
    expect(w.rated).toBe(4)
    expect(w.rising.map((r) => r.id)).toEqual(["x"])
    expect(w.rising[0].delta).toBeCloseTo(8, 5)
    expect(w.rising[0].games).toBe(6)
    // y fell by the same amount but was still at the top over the season; w did not move and z did not move.
    expect(w.bounce.map((r) => r.id)).toEqual(["y"])
  })

  it("leaves out a cooled-off player whose whole season was weak", () => {
    // Every game totals 15 points, so the pace adjustment does not move anyone else. z falls from 3 to 0 and w rises
    // from 0 to 3, but z's season (2.0 per 20) sits below the middle of the league (3.7).
    const weak = [...[0, 1, 2].map((n) => game(n, { x: 8, y: 4, z: 3, w: 0 })), ...[3, 4, 5].map((n) => game(n, { x: 8, y: 4, z: 0, w: 3 }))]
    const w = watchList(state(weak))
    expect(w.bounce).toEqual([])
    expect(w.rising.map((r) => r.id)).toEqual(["w"])
  })

  it("needs 4 box-scored games and ignores games with no box score", () => {
    expect(watchList(state(six.slice(0, 3))).rated).toBe(0)
    const noBox = six.map((g) => ({ ...g, scoringEvents: [] }))
    expect(watchList(state(noBox))).toEqual({ rising: [], bounce: [], rated: 0 })
  })
})
