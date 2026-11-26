import { describe, expect, it } from "vitest"
import { bracket, closeMatch, liveVoting, newBracket, nextMatch, openMatch, roundName, seedOrder, undoClose, type PotyVote } from "./playOfYear"

const seeds = Array.from({ length: 8 }, (_, i) => `c${i + 1}`)
const start = new Date("2026-12-01T00:00:00Z")
const p = newBracket(seeds, "Summer 2026", start, false)!
const day = (n: number) => new Date(start.getTime() + n * 86_400_000 + 1000)
const v = (match: string, pick: string, owner: string): PotyVote => ({ bracket: p.id, match, pick, owner })

describe("playOfYear", () => {
  it("seeds so the top two meet last", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
  })
  it("opens one round at a time", () => {
    expect(bracket(p, [], day(0)).current).toBe(0)
    expect(bracket(p, [], day(3)).current).toBe(1)
    expect(bracket(p, [], day(9)).current).toBeNull()
  })
  it("advances the play with more votes, and the higher seed on a tie", () => {
    const votes = [v("r0m0", "c8", "x"), v("r0m0", "c8", "y"), v("r0m0", "c1", "z"), v("r0m1", "c5", "x"), v("r0m1", "c4", "y")]
    const b = bracket(p, votes, day(3))
    expect(b.rounds[0][0].winner).toBe("c8")
    expect(b.rounds[0][1].winner).toBe("c4") // a tie: seed 4 over seed 5
    expect(b.rounds[1][0].a).toBe("c8")
    expect(b.rounds[1][0].b).toBe("c4")
  })
  it("ignores votes for a play that is not in the match, and crowns a champion", () => {
    const b = bracket(p, [v("r2m0", "c7", "x")], day(9))
    expect(b.champion).toBe("c1")
    expect(roundName(2, 3)).toBe("Final")
    expect(roundName(0, 4)).toBe("Round of 16")
  })

  it("runs live, one matchup at a time, in bracket order", () => {
    let q = newBracket(seeds, "Live", start)!
    const lv = (match: string, pick: string, owner: string): PotyVote => ({ bracket: q.id, match, pick, owner })
    expect(nextMatch(bracket(q, []))?.id).toBe("r0m0")
    q = openMatch(q, "r0m0")
    expect(liveVoting(q)).toBe(true)
    const votes = [lv("r0m0", "c8", "x"), lv("r0m0", "c8", "y"), lv("r0m0", "c1", "z")]
    let b = bracket(q, votes)
    expect(b.rounds[0][0].open).toBe(true)
    expect(b.rounds[0][0].winner).toBeNull()
    q = closeMatch(q)
    b = bracket(q, votes)
    expect(b.rounds[0][0].winner).toBe("c8")
    expect(b.rounds[1][0].a).toBe("c8")
    expect(nextMatch(b)?.id).toBe("r0m1")
    expect(undoClose(q).openMatch).toBe("r0m0")
    // Close every remaining matchup with no votes: higher seeds go through, and the top seed left wins.
    for (let i = 0; i < 6; i++) q = closeMatch(openMatch(q, nextMatch(bracket(q, votes))!.id))
    expect(bracket(q, votes).champion).toBe("c2")
    expect(nextMatch(bracket(q, votes))).toBeNull()
  })
})
