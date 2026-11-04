import { describe, expect, it } from "vitest"
import { compareMeans, compareNights, compareRates, laterGames, leagueFlow, phaseOf, playerFlow, timedGame } from "@/lib/gameFlow"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const shot = (scorerId: string, ok: boolean, t: number | null, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id: `${scorerId}${t}${Math.random()}`, scorerId, points: 2, made: ok, videoTime: t, ...extra })
const game = (id: string, shots: ScoringEvent[], extra: Partial<Game> = {}): Game => ({
  id,
  date: "2026-08-10",
  teamA: ["x"],
  teamB: ["y"],
  stats: [],
  scoringEvents: shots,
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
  ...extra,
})
const state = (games: Game[]): PooleanState => ({ players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }], games })
// 12 shots over 300 seconds, 4 in each third, made as given (first 4 early, next 4 middle, last 4 late).
const thirds = (outcomes: boolean[], who = "x") => [0, 20, 40, 60, 110, 150, 190, 199, 220, 260, 280, 300].map((t, i) => shot(who, outcomes[i], t))

describe("game phases", () => {
  it("puts shots in thirds by elapsed time, the last shot included", () => {
    expect([0, 99, 100, 199, 200, 300].map((t) => phaseOf(t, 0, 300))).toEqual(["early", "early", "middle", "middle", "late", "late"])
    const f = leagueFlow(state([game("a", thirds([true, true, false, false, true, false, false, false, true, true, true, false]))]))
    expect(f.phases.map((p) => [p.shots.made, p.shots.att])).toEqual([[2, 4], [1, 4], [3, 4]])
    expect(f.phases[0].minutes).toBeCloseTo(100 / 60, 5)
  })

  it("skips short games and games where any shot has no time", () => {
    expect(timedGame(game("short", thirds(Array(12).fill(true)).slice(0, 11)))).toBeNull()
    const untimed = thirds(Array(12).fill(true))
    untimed[5] = shot("x", true, null)
    expect(timedGame(game("untimed", untimed))).toBeNull()
    expect(leagueFlow(state([game("short", thirds(Array(12).fill(true)).slice(0, 11))])).games).toBe(0)
  })

  it("counts a player's own shots and only the games they played in", () => {
    const g1 = game("a", [...thirds(Array(12).fill(true), "x")])
    const g2 = game("b", [...thirds(Array(12).fill(false), "y")], { teamA: ["y"], teamB: ["z"] })
    const f = playerFlow(state([g1, g2]), "x")
    // 12 shots, minus the make that ended the game.
    expect(f.games).toBe(1)
    expect(f.shots).toBe(11)
    expect(f.phases.reduce((n, p) => n + p.shots.att, 0)).toBe(11)
  })
})

describe("the shot that ends a game", () => {
  const allMade = Array(12).fill(true)
  it("is left out of every shooting measure when the game finished on a make", () => {
    const f = leagueFlow(state([game("a", thirds(allMade))]))
    expect(f.shots).toBe(11)
    expect(f.phases[2].shots).toEqual({ made: 3, att: 3 })
    // Warm-up and hot-hand sequences drop it too: 11 shots, the first 3 in the warm-up.
    expect(f.warm.first.att + f.warm.rest.att).toBe(11)
    expect(f.hot.afterMake.att).toBe(10)
  })

  it("stays in when the game was stopped early, since nothing forced that make", () => {
    const f = leagueFlow(state([game("a", thirds(allMade), { stoppedEarly: true })]))
    expect(f.shots).toBe(12)
    expect(f.phases[2].shots).toEqual({ made: 4, att: 4 })
  })

  it("stays in when the last shot was a miss", () => {
    const f = leagueFlow(state([game("a", thirds([...allMade.slice(0, 11), false]))]))
    expect(f.shots).toBe(12)
  })
})

describe("shooting by points scored", () => {
  it("bins shots by the points already scored out of the game's total, leaving out the game-ending make", () => {
    // Six makes of 2 points is 12 in all. Each bin is a third of those points: 0-3, 4-7, 8-12.
    const outcomes = [true, true, true, true, false, false, false, false, false, false, true, true]
    const f = leagueFlow(state([game("a", thirds(outcomes))]))
    expect(f.byScore).toEqual([{ made: 2, att: 2 }, { made: 2, att: 2 }, { made: 1, att: 7 }])
  })
})

describe("games on a night", () => {
  it("numbers games on one recording in order and measures rest between them, ignoring games on their own recording", () => {
    const a = game("a", thirds(Array(12).fill(true)).map((s) => ({ ...s, videoTime: s.videoTime! + 1000 })), { masterVideoId: "m", videoStart: 1000 })
    const b = game("b", thirds(Array(12).fill(false)).map((s) => ({ ...s, videoTime: s.videoTime! + 2000 })), { masterVideoId: "m", videoStart: 2000 })
    const lone = game("lone", thirds(Array(12).fill(true)), { masterVideoId: "other", videoStart: 0 })
    const f = leagueFlow(state([b, lone, a]))
    expect(f.nights[0]).toMatchObject({ games: 1, shots: { made: 11, att: 11 } })
    expect(f.nights[1]).toMatchObject({ games: 1, shots: { made: 0, att: 12 } })
    // Game a ends at 1300 and game b starts at 2000: 700 seconds of rest.
    expect(f.nights[1].restMinutes[0]).toBeCloseTo(700 / 60, 5)
    expect(f.nights[2].games).toBe(0)
  })
})

describe("warm-up and hot hand", () => {
  const seq = [1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 0].map(Boolean)
  it("splits a shooter's first 3 shots from the rest and after a make from after a miss", () => {
    const f = leagueFlow(state([game("a", thirds(seq))]))
    expect(f.warm.first).toEqual({ made: 2, att: 3 })
    expect(f.warm.rest).toEqual({ made: 4, att: 9 })
    expect(f.hot.afterMake).toEqual({ made: 3, att: 6 })
    expect(f.hot.afterMiss).toEqual({ made: 2, att: 5 })
  })

  it("counts only shooters with at least 6 shots in a game toward the warm-up", () => {
    // x takes 12 shots; y takes only 3, all made, which would flatter the first-shots group if they counted.
    const yShots = [shot("y", true, 5), shot("y", true, 105), shot("y", true, 205)]
    const f = leagueFlow(state([game("a", [...thirds(seq), ...yShots])]))
    expect(f.warm.first).toEqual({ made: 2, att: 3 })
    expect(f.warm.rest).toEqual({ made: 4, att: 9 })
    // The hot hand still uses everyone's sequence: y adds 2 pairs after a make, both made.
    expect(f.hot.afterMake).toEqual({ made: 5, att: 8 })
  })

  it("never pairs the last shot of one game with the first of the next", () => {
    const f = leagueFlow(state([game("a", thirds(seq)), game("b", thirds(seq))]))
    expect(f.hot.afterMake).toEqual({ made: 6, att: 12 })
    expect(f.hot.afterMiss).toEqual({ made: 4, att: 10 })
  })
})

describe("compareRates", () => {
  it("says clear, hint or too early, and refuses tiny samples", () => {
    expect(compareRates({ made: 20, att: 100 }, { made: 40, att: 100 }).verdict).toBe("clear")
    expect(compareRates({ made: 30, att: 100 }, { made: 45, att: 100 }).verdict).toBe("hint")
    expect(compareRates({ made: 30, att: 100 }, { made: 38, att: 100 }).verdict).toBe("early")
    expect(compareRates({ made: 50, att: 100 }, { made: 50, att: 100 }).verdict).toBe("early")
    expect(compareRates({ made: 0, att: 5 }, { made: 5, att: 5 })).toEqual({ diff: null, z: null, verdict: "early" })
    expect(compareRates({ made: 20, att: 100 }, { made: 40, att: 100 }).diff).toBeCloseTo(20, 5)
  })
})

describe("honest comparisons", () => {
  it("compares averages the same way", () => {
    const heavy = { sum: 300, sq: 900, n: 100 } // everything contested at 3
    const light = { sum: 100, sq: 100, n: 100 } // everything at 1
    expect(compareMeans(light, heavy).verdict).toBe("clear")
    expect(compareMeans(light, heavy).diff).toBeCloseTo(2, 5)
    expect(compareMeans({ sum: 1, sq: 1, n: 3 }, heavy).verdict).toBe("early")
  })

  it("will not compare a night's games until each side has 3 games", () => {
    const mk = (n: 1 | 2 | 3, games: number, made: number, att: number) => ({ n, games, shots: { made, att }, pts: 0, minutes: 0, turnovers: 0, contest: { sum: 0, sq: 0, n: 0 }, restMinutes: [] as number[] })
    const flow = (g1: ReturnType<typeof mk>, g2: ReturnType<typeof mk>, g3: ReturnType<typeof mk>) => ({ games: 0, shots: 0, phases: [], byScore: [], nights: [g1, g2, g3], warm: { first: { made: 0, att: 0 }, rest: { made: 0, att: 0 } }, hot: { afterMake: { made: 0, att: 0 }, afterMiss: { made: 0, att: 0 } } })
    // One lonely 19-shot game that went 11 for 19 does not decide it.
    expect(compareNights(flow(mk(1, 3, 36, 109), mk(2, 3, 34, 122), mk(3, 1, 11, 19))).verdict).toBe("early")
    expect(laterGames(flow(mk(1, 3, 36, 109), mk(2, 3, 34, 122), mk(3, 1, 11, 19))).games).toBe(4)
    // Two games on one side is under the minimum, however different they look.
    expect(compareNights(flow(mk(1, 2, 10, 100), mk(2, 1, 60, 100), mk(3, 1, 60, 100))).verdict).toBe("early")
    // Plenty of games and a big gap does count.
    expect(compareNights(flow(mk(1, 4, 20, 100), mk(2, 3, 40, 100), mk(3, 1, 40, 100))).verdict).toBe("clear")
  })
})
