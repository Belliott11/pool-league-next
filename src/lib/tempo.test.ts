import { describe, expect, it } from "vitest"
import type { Game, PooleanState } from "@/lib/types"
import { tempo } from "@/lib/tempo"

// One timed game, A against B. [team, points, made, seconds]. Made baskets run A A A B B B B A B B A B, so B comes back
// from 0-6 and takes the lead once.
const seq: [string, 2, boolean, number][] = [
  ["a", 2, true, 0], ["a", 2, true, 10], ["a", 2, true, 20], ["b", 2, true, 30], ["b", 2, true, 40], ["b", 2, true, 50], ["b", 2, true, 60],
  ["a", 2, false, 70], ["a", 2, true, 80], ["b", 2, true, 90], ["b", 2, true, 100], ["a", 2, true, 110], ["b", 2, true, 120],
]
const game: Game = {
  id: "g",
  date: "2026-07-01",
  teamA: ["a"],
  teamB: ["b"],
  stats: [],
  scoringEvents: seq.map(([p, points, made, t], i) => ({ id: `e${i}`, scorerId: p, points, made, videoTime: t })),
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
}
const state = (games: Game[]): PooleanState => ({ players: [{ id: "a", name: "A" }, { id: "b", name: "B" }], games })

describe("tempo", () => {
  const t = tempo(state([game]))
  it("measures pace as plays and the time between them", () => {
    expect(t.games).toBe(1)
    expect(t.plays).toBe(13)
    expect(t.minutes).toBe(2)
    expect(t.gapMedian).toBe(10)
  })
  it("finds the longest run, the lead change and the comeback", () => {
    expect(t.runs.top[0]).toMatchObject({ points: 8, baskets: 4 })
    expect(t.swings.leadChanges).toBe(1)
    expect(t.swings.ties).toBe(2)
    expect(t.swings.comebacks[0].deficit).toBe(6)
  })
  it("groups shots by the shooter's margin, leaving out the basket that ends the game", () => {
    expect(t.state.trailing).toEqual({ made: 3, att: 3 })
    expect(t.state.leading).toEqual({ made: 1, att: 1 })
    expect(t.state.close).toEqual({ made: 7, att: 8 })
  })
  it("will not call streakiness from fewer than 3 games", () => {
    expect(t.runs.streaky.verdict).toBe("early")
    expect(t.runs.streaky.z).toBeNull()
  })
  it("calls long runs clear when several games are all streaks", () => {
    const streaky = (id: string): Game => ({ ...game, id, scoringEvents: ["a", "a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b", "b"].map((p, i) => ({ id: `${id}${i}`, scorerId: p, points: 2 as const, made: true, videoTime: i * 10 })) })
    const s = tempo(state([streaky("1"), streaky("2"), streaky("3"), streaky("4")])).runs.streaky
    expect(s.z).toBeLessThan(-2.5)
    expect(s.verdict).toBe("clear")
  })
  it("skips games without video times", () => {
    const untimed = { ...game, scoringEvents: game.scoringEvents.map((e) => ({ ...e, videoTime: null })) }
    expect(tempo(state([untimed])).games).toBe(0)
  })
})
