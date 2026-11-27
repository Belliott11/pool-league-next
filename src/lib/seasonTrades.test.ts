import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { decideOffer, makeOffer, MAX_OPEN, respondToOffer, tradeProblem, withdrawOffer, type TradeOffer } from "./seasonTrades"

const set = {
  teams: [
    { id: "a", captain: "ca", members: ["ca", "p1", "p2"] },
    { id: "b", captain: "cb", members: ["cb", "q1", "q2"] },
  ],
  offers: [] as TradeOffer[],
}
const ok = <T,>(x: T | string): T => {
  if (typeof x === "string") throw new Error(x)
  return x
}

describe("season trades", () => {
  it("keeps the server's copy identical", () => {
    const root = path.resolve(import.meta.dirname, "../..")
    expect(fs.readFileSync(path.join(root, "supabase/functions/season-draft/seasonTrades.ts"), "utf8")).toBe(fs.readFileSync(path.join(root, "src/lib/seasonTrades.ts"), "utf8"))
  })
  it("checks who can be traded", () => {
    expect(tradeProblem(set, "a", "b", ["p1"], ["q1"])).toBeNull()
    expect(tradeProblem(set, "a", "b", ["ca"], ["q1"])).toMatch(/Captains/)
    expect(tradeProblem(set, "a", "b", ["q1"], ["q2"])).toMatch(/not on that team/)
    expect(tradeProblem(set, "a", "b", [], ["q1"])).toMatch(/at least one/)
    expect(tradeProblem(set, "a", "a", ["p1"], ["p2"])).toMatch(/another team/)
  })
  it("runs offer, answer and approval, each only by the right side", () => {
    let s = ok(makeOffer(set, "a", "b", ["p1"], ["q1"], "o1", "t1"))
    expect(respondToOffer(s, "o1", "a", true, "t2")).toMatch(/Only the captain it was offered to/)
    expect(withdrawOffer(s, "o1", "b", "t2")).toMatch(/Only the captain who made it/)
    expect(decideOffer(s, "o1", true, "t2")).toMatch(/Only an accepted trade/)
    s = ok(respondToOffer(s, "o1", "b", true, "t2"))
    expect(s.offers[0].status).toBe("accepted")
    s = ok(decideOffer(s, "o1", true, "t3"))
    expect(s.offers[0].status).toBe("approved")
    expect(respondToOffer(s, "o1", "b", false, "t4")).toMatch(/no longer open/)
  })
  it("caps open offers and lets a captain take one back", () => {
    let s: typeof set = set
    for (let i = 0; i < MAX_OPEN; i++) s = ok(makeOffer(s, "a", "b", ["p1"], ["q1"], `o${i}`, "t"))
    expect(makeOffer(s, "a", "b", ["p2"], ["q2"], "ox", "t")).toMatch(/open offers/)
    s = ok(withdrawOffer(s, "o0", "a", "t"))
    expect(s.offers[0].status).toBe("withdrawn")
  })
})
