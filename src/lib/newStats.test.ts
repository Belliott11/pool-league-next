import { expect, test } from "vitest"
import { clutchSplits } from "@/lib/clutch"
import { snakeDraft } from "@/lib/draft"
import { lineups } from "@/lib/lineups"
import type { PooleanState } from "@/lib/types"

test("pairs and trios get a record over shared games", () => {
  const rows = Array(4).fill({ a: ["x", "y", "z"], b: ["p", "q", "r"], aWon: true, night: "n" })
  const pairs = lineups(rows, 2)
  expect(pairs[0]).toMatchObject({ gp: 4, w: 4 })
  expect(pairs.at(-1)).toMatchObject({ gp: 4, w: 0 })
  expect(lineups(rows, 3).map((l) => l.ids.join())).toEqual(["x,y,z", "p,q,r"])
  expect(lineups(rows.slice(0, 2), 2)).toEqual([])
})

test("a shot is clutch only when late and close", () => {
  const shot = (scorerId: string, made = true) => ({ id: Math.random() + "", scorerId, points: 2 as const, made })
  // To 8: a goes 2, 4 (b 0): early. Then b 2, 4. At 4-4 the leader is at target minus 4, so the next shots are clutch.
  const g = { id: "g", date: "2026-01-01", teamA: ["a"], teamB: ["b"], liveTarget: 8, winner: "B", scoringEvents: [shot("a"), shot("a"), shot("b"), shot("b"), shot("a", false), shot("b"), shot("b")], turnoverEvents: [] }
  const rows = clutchSplits({ players: [], games: [g] } as unknown as PooleanState)
  const a = rows.find((r) => r.id === "a")!
  expect(a.rest).toMatchObject({ made: 2, att: 2 })
  expect(a.clutch).toMatchObject({ made: 0, att: 1 })
  expect(rows.find((r) => r.id === "b")!.clutch).toMatchObject({ made: 3, att: 3, pts: 6 })
})

test("draft: close captains snake, a clear gap gives the weaker captain every other pick", () => {
  const r: Record<string, number> = { A: 5, B: 4, p1: 9, p2: 8, p3: 7, p4: 6 }
  const d = snakeDraft("A", "B", Object.keys(r), (id) => r[id])
  expect(d.order.map((o) => o.to)).toEqual(["B", "A", "A", "B"])
  expect(d.b).toEqual(["B", "p1", "p4"])
  r.B = 1
  expect(snakeDraft("A", "B", Object.keys(r), (id) => r[id]).order.map((o) => o.to)).toEqual(["B", "A", "B", "A"])
})
