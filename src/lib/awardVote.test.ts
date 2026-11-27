import { describe, expect, it } from "vitest"
import { AWARDS, closeVoting, finished, newBallot, reopenVoting, revealNext, revealing, roundsInWords, runoff, showCard, toggleRank, undoReveal, verdict } from "@/lib/awardVote"
import { nextSteps } from "@/lib/nextSteps"
import { newGame } from "@/lib/store"
import type { AwardBallot, PooleanState } from "@/lib/types"

const players = ["ben", "zach", "ian", "kayla"].map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) }))
const games = Array.from({ length: 6 }, (_, i) => newGame({ id: `g${i}`, date: `2026-07-0${i + 1}`, teamA: ["ben", "zach"], teamB: ["ian", i < 1 ? "kayla" : "ian"], winner: "A" }))
const state = { players, games } as unknown as PooleanState

describe("season award votes", () => {
  it("only lists players with enough games, and needs three of them", () => {
    const b = newBallot(state, "Summer 2026", new Date("2026-08-20T00:00:00Z"))!
    expect(b.candidates.sort()).toEqual(["ben", "ian", "zach"])
    expect(b.awards.at(-1)).toBe("mvp") // revealed last
    expect(b.awards).toEqual(AWARDS.map((a) => a.key))
    expect(newBallot({ ...state, games: games.slice(0, 1) } as PooleanState, "x")).toBeNull()
  })

  it("wins outright with a majority of first choices", () => {
    const t = runoff([["ben", "zach"], ["ben"], ["zach", "ben"]])
    expect(t.winners).toEqual(["ben"])
    expect(t.rounds).toHaveLength(1)
    expect(t.total).toBe(3)
  })

  it("knocks out the fewest and moves those ballots to their next choice", () => {
    // First choices: Zach 2, Ben 2, Ian 1. Ian goes, and that ballot moves to Ben, who wins 3 to 2.
    const t = runoff([["zach"], ["zach", "ian"], ["ben"], ["ben", "zach"], ["ian", "ben"]])
    expect(t.rounds[0].counts).toEqual([{ id: "ben", n: 2 }, { id: "zach", n: 2 }, { id: "ian", n: 1 }])
    expect(t.rounds[0].out).toEqual(["ian"])
    expect(t.winners).toEqual(["ben"])
    expect(t.rounds[1].counts).toEqual([{ id: "ben", n: 3 }, { id: "zach", n: 2 }])
    expect(roundsInWords(t, (id) => id)[0]).toBe("Round 1: ben 2, zach 2, ian 1. ian was knocked out, and those ballots moved to the next choice.")
  })

  it("lets a ballot with nobody left on it stop counting, and shares a tie it cannot break", () => {
    const t = runoff([["ian"], ["ben"], ["zach"], ["ben"], ["zach"]])
    expect(t.rounds[0].out).toEqual(["ian"])
    expect(t.rounds[1].active).toBe(4)
    expect(t.winners).toEqual(["ben", "zach"])
    expect(runoff([]).winners).toEqual([])
  })

  it("puts a tapped player at the end of a ranking, or takes them out", () => {
    expect(toggleRank([], "ben")).toEqual(["ben"])
    expect(toggleRank(["ben"], "zach")).toEqual(["ben", "zach"])
    expect(toggleRank(["ben", "zach", "ian"], "zach")).toEqual(["ben", "ian"])
  })

  it("reveals one award at a time, closing voting first", () => {
    const now = new Date("2026-08-20T20:00:00Z")
    let b: AwardBallot = newBallot(state, "S", now)!
    b = revealNext(b, now)
    expect(b.open).toBe(false)
    expect(b.revealed).toBe(1)
    expect(reopenVoting(b).open).toBe(false) // never after a winner is out
    expect(revealing(b, now.getTime() + 60_000)).toBe(true)
    b = undoReveal(b, now)
    expect(reopenVoting(b, now).open).toBe(true)
    b = closeVoting(b, now)
    for (let i = 0; i < 10; i++) b = revealNext(b, now)
    expect(b.revealed).toBe(b.awards.length)
    expect(finished(b)).toBe(true)
    expect(revealing(b, now.getTime())).toBe(false)
    expect(showCard(b, now.getTime() + 20 * 86_400_000)).toBe(true)
    expect(showCard(b, now.getTime() + 22 * 86_400_000)).toBe(false)
  })

  it("says whether the players agreed with the numbers", () => {
    const name = (id: string) => id
    expect(verdict(runoff([["ben"]]), ["ben"], name)).toBe("The players and the numbers agree.")
    expect(verdict(runoff([["ben"]]), ["zach"], name)).toBe("The numbers had zach.")
    expect(verdict(runoff([["ben"], ["zach"]]), ["zach"], name)).toBe("The numbers had zach too.")
    expect(verdict(runoff([]), ["zach"], name)).toBeNull()
  })

  it("puts voting in a player's next steps while it is open", () => {
    const b = newBallot(state, "Summer 2026")!
    expect(nextSteps({ ...state, awardBallots: [b] } as PooleanState, "ben").map((s) => s.key)).toContain("awards")
    expect(nextSteps({ ...state, awardBallots: [closeVoting(b)] } as PooleanState, "ben").map((s) => s.key)).not.toContain("awards")
  })
})

describe("every award from last season is on the ballot", () => {
  it("has each of Poolean's awards, the two teams as one vote, MVP last", async () => {
    const { AWARDS } = await import("@/lib/awardVote")
    const { pastSeasonAwards } = await import("@/lib/pastAwards")
    const keys = AWARDS.map((a) => a.key)
    for (const a of pastSeasonAwards()[0].awards) expect(keys).toContain(a.key === "first-team" || a.key === "second-team" ? "teams" : a.key)
    expect(keys.at(-1)).toBe("mvp")
    expect(AWARDS.find((a) => a.key === "best-duo")!.kind).toBe("duo")
    expect(AWARDS.find((a) => a.key === "teams")!.kind).toBe("teams")
  })

  it("makes the same pair whichever player was tapped first", async () => {
    const { pairId, pairOf } = await import("@/lib/awardVote")
    expect(pairId("zach", "ben")).toBe("ben|zach")
    expect(pairId("ben", "zach")).toBe("ben|zach")
    expect(pairOf("ben|zach")).toEqual(["ben", "zach"])
  })

  it("fills the teams place by place, each a ranked-choice count without the players above", async () => {
    const { places, teamsOf } = await import("@/lib/awardVote")
    const ballots = [
      ["a", "b", "c", "d", "e", "f", "g"],
      ["a", "c", "b", "e", "d", "g", "f"],
      ["b", "a", "c", "d", "f", "e", "g"],
    ]
    expect(places(ballots)[0]).toEqual(["a"]) // 2 of 3 first choices
    const t = teamsOf(ballots)
    expect(t.first).toEqual(["a", "b", "c"])
    expect(t.second).toHaveLength(3)
    expect(t.second[0]).toBe("d")
  })
})
