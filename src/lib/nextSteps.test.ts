import { describe, expect, it } from "vitest"
import { MAX_STEPS, nextSteps } from "@/lib/nextSteps"
import { newGame } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

const base = (games: PooleanState["games"] = []): PooleanState =>
  ({ players: [{ id: "ben", name: "Ben" }, { id: "zach", name: "Zach" }], games }) as unknown as PooleanState

describe("next steps for a player", () => {
  it("puts a live game first and says when you are in it", () => {
    const live = newGame({ id: "g1", date: "2027-06-01", teamA: ["ben"], teamB: ["zach"], liveInProgress: true })
    const s = nextSteps(base([live]), "ben")
    expect(s[0].key).toBe("live")
    expect(s[0].text).toMatch(/You are in/)
    // No basket yet, so Pick'em is open too.
    expect(s.map((x) => x.key)).toContain("pickem")
  })

  it("never points at a test game", () => {
    const live = newGame({ id: "g1", date: "2027-06-01", teamA: ["ben"], teamB: ["zach"], liveInProgress: true, test: true })
    expect(nextSteps(base([live]), "ben").map((x) => x.key)).not.toContain("live")
    expect(nextSteps(base([live]), "ben").map((x) => x.key)).not.toContain("pickem")
  })

  it("offers film only for games with video times, and the rival's head to head", () => {
    const g = newGame({ id: "g2", date: "2026-07-01", teamA: ["ben"], teamB: ["zach"], winner: "A" })
    g.scoringEvents = [{ id: "e1", scorerId: "ben", points: 2, videoTime: 12 } as never]
    const s = nextSteps(base([g]), "ben", { rival: "zach" })
    expect(s.find((x) => x.key === "film")?.go).toEqual({ kind: "tab", tab: "film" })
    expect(s.find((x) => x.key === "rival")?.go).toEqual({ kind: "sub", sub: "h2h:ben,zach" })
    expect(nextSteps(base([g]), "zach").map((x) => x.key)).toContain("film")
  })

  it("shows at most a few", () => {
    const live = newGame({ id: "g1", date: "2027-06-01", teamA: ["ben"], teamB: ["zach"], liveInProgress: true })
    const g = newGame({ id: "g2", date: "2026-07-01", teamA: ["ben"], teamB: ["zach"], winner: "A" })
    g.scoringEvents = [{ id: "e1", scorerId: "ben", points: 2, videoTime: 12 } as never]
    expect(nextSteps(base([live, g]), "ben", { mixtape: true, rival: "zach" }).length).toBeLessThanOrEqual(MAX_STEPS)
  })
})
