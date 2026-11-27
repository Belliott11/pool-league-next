import { describe, expect, it } from "vitest"
import { lineAt, playByPlay } from "./playByPlay"
import type { Game } from "./types"

const game = {
  id: "g", teamA: ["z", "b"], teamB: ["r"],
  scoringEvents: [
    { id: "1", scorerId: "z", points: 3, made: true, assistId: "b", videoTime: 10 },
    { id: "2", scorerId: "r", points: 2, made: false, shotType: "drive", defenderIds: ["z"], contestLevel: "heavy", rebounderId: "b", videoTime: 20 },
  ],
  turnoverEvents: [{ id: "t", playerId: "r", stealEventId: "s" }],
  stealEvents: [{ id: "s", playerId: "b", opponentId: "r", videoTime: 30 }],
} as unknown as Game
const name = (p: string) => ({ z: "Zach", b: "Ben", r: "Reilly" })[p] ?? p

describe("playByPlay", () => {
  it("writes each logged play in order", () => {
    expect(playByPlay(game, name).map((l) => l.text)).toEqual([
      "Zach hits a 3 off Ben's pass.",
      "Reilly misses on the drive with Zach all over it. Ben grabs the board.",
      "Ben picks off Reilly.",
    ])
  })
  it("shows a line for a few seconds from its moment", () => {
    const l = playByPlay(game, name)
    expect(lineAt(l, 9)).toBeNull()
    expect(lineAt(l, 12)?.t).toBe(10)
    expect(lineAt(l, 15)).toBeNull()
  })
})
