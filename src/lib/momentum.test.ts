import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { basketsOf, chanceRunAtLeast, chanceRunWithPossession, expectedLongest, gameMomentum, leagueMomentum, runsChance, runsOf, streakCheck } from "@/lib/momentum"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// Every order of nA A's and nB B's, for checking the exact counts against brute force.
function orders(nA: number, nB: number): string[] {
  if (!nA && !nB) return [""]
  return [...(nA ? orders(nA - 1, nB).map((s) => "A" + s) : []), ...(nB ? orders(nA, nB - 1).map((s) => "B" + s) : [])]
}
const longest = (s: string) => Math.max(...(s.match(/A+|B+/g) ?? [""]).map((r) => r.length))
const runCount = (s: string) => (s.match(/A+|B+/g) ?? []).length

let id = 0
const ev = (scorerId: string, made = true, points = 2, videoTime?: number): ScoringEvent => ({ id: `e${id++}`, scorerId, made, points, videoTime }) as ScoringEvent
const game = (events: ScoringEvent[]): Game => ({ id: `g${id++}`, date: "2026-08-01", teamA: ["a1", "a2"], teamB: ["b1", "b2"], scoringEvents: events, stats: [], turnoverEvents: [] }) as unknown as Game

describe("runs against chance", () => {
  it("counts the chance of a long run exactly", () => {
    for (const [nA, nB] of [[3, 2], [5, 4], [6, 6], [7, 3]]) {
      const all = orders(nA, nB)
      for (let k = 1; k <= Math.max(nA, nB); k++) {
        const brute = all.filter((s) => longest(s) >= k).length / all.length
        expect(chanceRunAtLeast(nA, nB, k)).toBeCloseTo(brute, 10)
      }
      const avg = all.reduce((s, o) => s + longest(o), 0) / all.length
      expect(expectedLongest(nA, nB)).toBeCloseTo(avg, 10)
      expect(runsChance(nA, nB).mean).toBeCloseTo(all.reduce((s, o) => s + runCount(o), 0) / all.length, 10)
    }
  })

  it("reads a game's baskets in video order and finds its runs", () => {
    const g = game([ev("a1", true, 2, 30), ev("b1", true, 2, 10), ev("a2", false, 2, 20), ev("a2", true, 3, 40), ev("x", true, 2, 50)])
    const b = basketsOf(g)
    expect(b.map((k) => k.side).join("")).toBe("BAA")
    const runs = runsOf(b)
    expect(runs).toHaveLength(2)
    expect(runs[1]).toMatchObject({ side: "A", length: 2, points: 5, from: [0, 2], to: [5, 2] })
  })

  it("needs enough baskets from both teams", () => {
    expect(gameMomentum(game([ev("a1"), ev("b1"), ev("a1")]))).toBeNull()
    const m = gameMomentum(game([..."AAAABABBABAB"].map((s) => ev(s === "A" ? "a1" : "b1"))))!
    expect(m.longest).toMatchObject({ side: "A", length: 4 })
    // A scored again 3 of the 7 times one of its baskets was followed by another; B 1 of 4.
    expect(m.again.A).toBeCloseTo(3 / 7, 10)
    expect(m.again.B).toBeCloseTo(1 / 4, 10)
  })

  it("counts runs exactly when the team scored on gets the ball", () => {
    const again = { A: 0.4, B: 0.25 }
    for (const n of [5, 8, 11]) {
      // Every sequence of n baskets starting with A, weighted by its chance.
      let total = 0
      const at = new Map<number, number>()
      const walk = (seq: string, p: number) => {
        if (seq.length === n) {
          total += p
          for (let k = 1; k <= n; k++) if (longest(seq) >= k) at.set(k, (at.get(k) ?? 0) + p)
          return
        }
        const last = seq.at(-1) as "A" | "B"
        const other = last === "A" ? "B" : "A"
        walk(seq + last, p * again[last])
        walk(seq + other, p * (1 - again[last]))
      }
      walk("A", 1)
      expect(total).toBeCloseTo(1, 10)
      for (let k = 1; k <= n; k++) expect(chanceRunWithPossession(n, "A", again, k)).toBeCloseTo(at.get(k) ?? 0, 10)
    }
  })

  it("gives the shuffled after-make rate that a brute-force shuffle gives", () => {
    // One player, one game: makes and misses as below. Average over every distinct order of the same shots.
    const shots = [true, true, false, true, false, false, true]
    const g = game(shots.map((m) => ev("a1", m)))
    const s = streakCheck({ games: [g], players: [] } as unknown as PooleanState)!
    let mAtt = 0, mMade = 0
    const all = orders(4, 3).map((o) => [...o].map((c) => c === "A"))
    for (const o of all) for (let i = 1; i < o.length; i++) if (o[i - 1]) (mAtt++, o[i] && mMade++)
    expect(s.chanceAfterMake).toBeCloseTo((mMade / mAtt) * 100, 10)
    expect(s.afterMake).toEqual({ made: 1, att: 3 })
  })
})

it.skipIf(!existsSync("public/test-data.json"))("works on the live league data", () => {
  const state = JSON.parse(readFileSync("public/test-data.json", "utf8")) as PooleanState
  const m = leagueMomentum(state)!
  expect(m.games.length).toBeGreaterThan(0)
  for (const g of m.games) expect(g.chance).toBeGreaterThan(0)
})
