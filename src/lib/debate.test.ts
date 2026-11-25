import { existsSync, readFileSync } from "node:fs"
import { expect, it, vi } from "vitest"
import type { PooleanState } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { allTimeRecord, bestAgainst, taleOfTheTape } = await import("@/lib/debate")
const { pairRecord } = await import("@/lib/headToHead")

it("counts every result a player was in", () => {
  const [w, l] = allTimeRecord("ben")
  const { vs, together } = pairRecord("ben", "zach")
  expect(w + l).toBeGreaterThanOrEqual(vs[0] + vs[1] + together[0] + together[1])
  expect(allTimeRecord("nobody-at-all")).toEqual([0, 0])
})

it.skipIf(!existsSync("public/test-data.json"))("gives each row to the better player and counts the verdict", async () => {
  const state = JSON.parse(readFileSync("public/test-data.json", "utf8")) as PooleanState
  ;(await import("@/lib/per")).setPaceGames(state.games)
  ;(await import("@/lib/matchup")).setAppGames(state.games)
  const t = taleOfTheTape(state, "ben", "zach")
  let a = 0, b = 0
  for (const r of t.rows) if (r.a !== null && r.b !== null && r.a !== r.b) (r.a > r.b) === r.higher ? a++ : b++
  expect([t.aWins, t.bWins]).toEqual([a, b])
  for (const g of bestAgainst(state, "ben", "zach")) expect(["ben", "zach"]).toContain(g.id)
})
