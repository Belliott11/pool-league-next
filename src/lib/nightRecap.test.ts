import { describe, expect, it } from "vitest"
import { gameDays, summarizeNight } from "@/lib/nightRecap"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const liveGame = (id: string, date: string, a: string[], b: string[], scores: [string, number][]): Game => ({
  ...base,
  id,
  date,
  teamA: a,
  teamB: b,
  liveScores: scores.map(([pid, points]) => ({ pid, points })),
})
const boxGame: Game = {
  ...base,
  id: "box",
  date: "2026-10-04",
  teamA: ["x", "y"],
  teamB: ["z"],
  scoringEvents: [{ id: "s1", scorerId: "x", points: 2 }],
  stats: [
    { playerId: "x", pts: 12, oreb: 1, dreb: 3, ast: 2, stl: 1, blk: 0, tov: 0, pf: 0 },
    { playerId: "y", pts: 6, oreb: 0, dreb: 1, ast: 4, stl: 0, blk: 1, tov: 0, pf: 0 },
    { playerId: "z", pts: 10, oreb: 2, dreb: 2, ast: 0, stl: 2, blk: 0, tov: 0, pf: 0 },
  ],
}
const state = (games: Game[]): PooleanState => ({ players: [], games })

describe("summarizeNight", () => {
  it("lists the game days newest first", () => {
    expect(gameDays(state([liveGame("a", "2026-10-01", ["x"], ["z"], []), boxGame, liveGame("b", "2026-10-04", ["x"], ["z"], [])]))).toEqual(["2026-10-04", "2026-10-01"])
  })

  it("scores live-only games from their baskets and tallies wins", () => {
    const s = summarizeNight(
      state([
        liveGame("g1", "2026-10-04", ["x"], ["z"], [["x", 3], ["x", 2], ["z", 2]]),
        liveGame("g2", "2026-10-04", ["x"], ["z"], [["z", 3], ["z", 3], ["x", 2]]),
        liveGame("old", "2026-09-01", ["x"], ["z"], [["x", 9]]),
      ]),
      "2026-10-04",
    )
    expect(s.games.map((g) => [g.scoreA, g.scoreB])).toEqual([[5, 2], [2, 6]])
    const x = s.players.find((p) => p.id === "x")!
    expect([x.pts, x.wins, x.losses, x.best]).toEqual([7, 1, 1, 5])
    expect(s.totalPoints).toBe(15)
    expect(s.biggestWin?.id).toBe("g2")
    expect(s.closest?.id).toBe("g1")
  })

  it("uses the box score when there is one, adding the extras", () => {
    const s = summarizeNight(state([boxGame]), "2026-10-04")
    const x = s.players.find((p) => p.id === "x")!
    expect([x.pts, x.reb, x.ast, x.stl, x.boxGames]).toEqual([12, 4, 2, 1, 1])
    expect(s.topScorer?.id).toBe("x")
    expect(s.games[0].winner).toBe("A")
  })

  it("keeps a game in progress out of the standings", () => {
    const g = { ...liveGame("now", "2026-10-04", ["x"], ["z"], [["x", 2]]), liveInProgress: true }
    const s = summarizeNight(state([g]), "2026-10-04")
    expect(s.games[0].live).toBe(true)
    expect(s.players).toEqual([])
  })
})
