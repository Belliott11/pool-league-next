import { describe, expect, it } from "vitest"
import { backtestAppGames, backtestPick, setAppGames } from "@/lib/matchup"
import { realSeasonsInOrder } from "@/lib/real"
import { predictionNote, scorecard, winnerOf } from "@/lib/scorecard"
import type { Game, PooleanState } from "@/lib/types"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
const game = (id: string, pA: number | null, scores: [string, number][], live = false): Game => ({
  ...base,
  id,
  date: "2026-10-06",
  teamA: ["x"],
  teamB: ["z"],
  liveScores: scores.map(([pid, points]) => ({ pid, points })),
  ...(live ? { liveInProgress: true } : {}),
  ...(pA === null ? {} : { prediction: { pA, at: "2026-10-06T00:00:00Z" } }),
})
const state = (games: Game[]): PooleanState => ({ players: [], games })

describe("prediction scorecard", () => {
  it("scores each saved pick against the real winner", () => {
    const sc = scorecard(
      state([
        game("a", 0.7, [["x", 5], ["z", 2]]), // favorite A won
        game("b", 0.6, [["x", 2], ["z", 5]]), // favorite A lost
        game("c", 0.3, [["x", 2], ["z", 5]]), // favorite B won
        game("d", null, [["x", 5]]), // no saved pick: not counted
        game("e", 0.8, [["x", 1]], true), // still being played: waiting
      ]),
    )
    expect(sc.called).toBe(3)
    expect(sc.correct).toBe(2)
    expect(sc.pct).toBe(67)
    expect(sc.waiting).toBe(1)
    expect(sc.buckets.find((b) => b.label === "70% or more")).toMatchObject({ called: 2, correct: 2 })
  })

  it("describes the pick next to the result", () => {
    expect(predictionNote(game("a", 0.7, [["x", 5], ["z", 2]]))).toBe("Model picked Team A (70%), right")
    expect(predictionNote(game("b", 0.7, [["x", 2], ["z", 5]]))).toBe("Model picked Team A (70%), wrong")
    expect(predictionNote(game("c", null, [["x", 2]]))).toBeNull()
    expect(winnerOf(game("d", 0.5, [["x", 2], ["z", 2]]))).toBeNull()
  })
})

describe("backtest on past games", () => {
  // Games dated after the imported history, with winners, so the model calls each from only what came before it.
  const mk = (id: string, day: number, a: number, b: number): Game => ({ ...base, id, date: `2099-01-${String(day).padStart(2, "0")}`, teamA: ["x"], teamB: ["z"], liveScores: [{ pid: "x", points: a }, { pid: "z", points: b }] })
  const games = [mk("p1", 1, 5, 2), mk("p2", 2, 2, 5), mk("p3", 3, 6, 1)]

  it("calls each past game and counts it apart from saved picks", () => {
    setAppGames(games)
    const calls = backtestAppGames()
    expect([...calls.keys()].sort()).toEqual(["p1", "p2", "p3"])
    for (const p of calls.values()) expect(p).toBeGreaterThan(0)
    const sc = scorecard(state(games))
    expect(sc.called).toBe(0)
    // A game with nothing before it to go on comes out at exactly 50% and is not scored as a call.
    expect(sc.backtest.called).toBe([...calls.values()].filter((p) => p !== 0.5).length)
    expect(sc.backtest.called).toBeGreaterThan(0)
    expect(predictionNote(games.find((g) => g.id === [...calls].find(([, p]) => p !== 0.5)![0]))).toMatch(/^Backtest pick: Team [AB] \(\d+%\), (right|wrong)$/)
    setAppGames([])
  })

  it("keeps a saved pick ahead of a backtest call", () => {
    const saved = { ...games[0], prediction: { pA: 0.9, at: "2026-10-06T00:00:00Z" } }
    setAppGames([saved, games[1], games[2]])
    expect(predictionNote(saved)).toBe("Model picked Team A (90%), right")
    const others = [...backtestAppGames()].filter(([id, p]) => id !== "p1" && p !== 0.5).length
    expect(scorecard(state([saved, games[1], games[2]])).backtest.called).toBe(others)
    setAppGames([])
  })
})

describe("backtest on imported history", () => {
  it("matches a game in the app to its imported night and calls it from the nights before", () => {
    const seasons = realSeasonsInOrder()
    const last = seasons[seasons.length - 1].games.reduce((m, g) => (g.date > m.date ? g : m))
    const asApp: Game = { ...base, id: "old", date: last.date, teamA: last.a, teamB: last.b, liveScores: [{ pid: last.a[0], points: 5 }, { pid: last.b[0], points: 2 }] }
    const p = backtestPick(asApp)
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(1)
    // The same game entered with the sides swapped gets the mirror-image chance.
    const swapped = backtestPick({ ...asApp, teamA: last.b, teamB: last.a }) as number
    expect(swapped).toBeCloseTo(1 - (p as number), 6)
  })
})

describe("pick'em standings", () => {
  it("scores each voter on finished games and the model on the same games", async () => {
    const { pickemStandings, openForVotes } = await import("@/lib/pickem")
    const done = game("g1", 0.7, [["x", 5], ["z", 2]]) // A won, the model picked A
    const done2 = game("g2", 0.7, [["x", 2], ["z", 5]]) // B won, the model picked A
    const open: Game = { ...base, id: "g3", date: "2026-10-07", teamA: ["x"], teamB: ["z"] }
    const st = state([done, done2, open])
    const votes = [
      { gameId: "g1", voter: "a", pick: "A" as const },
      { gameId: "g2", voter: "a", pick: "B" as const },
      { gameId: "g1", voter: "b", pick: "B" as const },
      { gameId: "g3", voter: "a", pick: "A" as const },
    ]
    const s = pickemStandings(st, votes)
    expect(s.rows).toEqual([{ voter: "a", right: 2, total: 2 }, { voter: "b", right: 0, total: 1 }])
    expect(s.model).toEqual({ right: 1, total: 2 })
    expect(openForVotes(st).map((g) => g.id)).toEqual(["g3"])
  })
})
