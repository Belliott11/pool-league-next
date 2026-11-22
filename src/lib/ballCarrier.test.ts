import { expect, test } from "vitest"
import { ballMoments } from "@/lib/ballCarrier"
import type { Game, PooleanState } from "@/lib/types"

const state = { players: [{ id: "adam", name: "Adam" }, { id: "alex", name: "Alex" }, { id: "sean", name: "Sean" }, { id: "ben", name: "Ben" }], games: [] } as unknown as PooleanState
const game = (scoring: object[], steals: object[] = []) => ({ scoringEvents: scoring, stealEvents: steals }) as unknown as Game

test("a pass, a missed shot and a rebound, in order, starting with the passer", () => {
  const g = game([{ id: "s1", scorerId: "alex", passerId: "adam", made: false, rebounderId: "sean", videoTime: 100 }])
  const { start, moments } = ballMoments(state, g, 96, 104)
  expect(start).toBe("adam")
  expect(moments).toEqual([
    { t: 98.5, who: "alex", label: "Adam passes to Alex", about: true },
    { t: 100, who: null, label: "Alex shoots and misses" },
    { t: 101.2, who: "sean", label: "Sean gets the rebound", about: true },
  ])
})

test("an unassisted shot starts with the shooter, and the log's 'none' passer is no one", () => {
  const g = game([{ id: "s1", scorerId: "ben", passerId: "none", made: true, videoTime: 50 }])
  expect(ballMoments(state, g, 48, 56)).toEqual({ start: "ben", moments: [{ t: 50, who: null, label: "Ben shoots and scores" }] })
})

test("a steal hands it over, and a clip with nothing in it starts with whoever last got the ball", () => {
  const g = game([{ id: "s1", scorerId: "alex", made: false, rebounderId: "ben", videoTime: 10 }], [{ id: "t1", playerId: "sean", opponentId: "ben", videoTime: 20 }])
  expect(ballMoments(state, g, 18, 24)).toEqual({ start: "ben", moments: [{ t: 20, who: "sean", label: "Sean steals it from Ben" }] })
  expect(ballMoments(state, g, 12.5, 15).start).toBe("ben")
})
