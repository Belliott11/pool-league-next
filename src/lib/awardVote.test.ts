import { describe, expect, it } from "vitest"
import { AWARDS, closeVoting, finished, newBallot, reopenVoting, revealNext, revealing, showCard, tally, undoReveal, verdict } from "@/lib/awardVote"
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

  it("counts votes, with ties as co-winners", () => {
    expect(tally(["ben", "zach", "ben"])).toEqual({ winners: ["ben"], votes: [{ id: "ben", n: 2 }, { id: "zach", n: 1 }], total: 3 })
    expect(tally(["ben", "zach"]).winners).toEqual(["ben", "zach"])
    expect(tally([]).winners).toEqual([])
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
    expect(verdict(tally(["ben"]), ["ben"], name)).toBe("The players and the numbers agree.")
    expect(verdict(tally(["ben"]), ["zach"], name)).toBe("The numbers had zach.")
    expect(verdict(tally(["ben", "zach"]), ["zach"], name)).toBe("The numbers had zach too.")
    expect(verdict(tally([]), ["zach"], name)).toBeNull()
  })

  it("puts voting in a player's next steps while it is open", () => {
    const b = newBallot(state, "Summer 2026")!
    expect(nextSteps({ ...state, awardBallots: [b] } as PooleanState, "ben").map((s) => s.key)).toContain("awards")
    expect(nextSteps({ ...state, awardBallots: [closeVoting(b)] } as PooleanState, "ben").map((s) => s.key)).not.toContain("awards")
  })
})
