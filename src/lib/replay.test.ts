import { expect, it } from "vitest"
import { replaySteps } from "@/lib/replay"
import type { Game } from "@/lib/types"

it("orders shots by video time when all have one, and keeps the running score", () => {
  const g = { teamA: ["a"], teamB: ["b"], scoringEvents: [
    { id: "2", scorerId: "b", points: 3, made: true, videoTime: 20, shotLocation: { x: 50, y: 70 } },
    { id: "1", scorerId: "a", points: 2, videoTime: 10 },
    { id: "3", scorerId: "a", points: 2, made: false, videoTime: 30 },
  ] } as unknown as Game
  const s = replaySteps(g)
  expect(s.map((x) => x.id)).toEqual(["1", "2", "3"])
  expect(s.map((x) => [x.a, x.b])).toEqual([[2, 0], [2, 3], [2, 3]])
  expect(s[1].at).toEqual({ x: 50, y: 70 })
  expect(s[2].made).toBe(false)
})
