import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { filter } from "@/lib/form"
import type { PooleanState } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const FILE = "public/test-data.json"

describe("the form filter", () => {
  it("moves a new player off the league average by how much one game says", () => {
    // Talent spread 1, game noise 2: one game is worth a fifth (1 / (1 + 4)) of the way to what it showed.
    const [first] = filter([5], 2, 1, 0)
    expect(first.mean).toBeCloseTo(1, 9)
    expect(first.v).toBeCloseTo(0.8, 9)
  })
  it("trusts a steady part faster than a noisy one", () => {
    expect(filter([3, 3, 3], 0.5, 1, 0).at(-1)!.mean).toBeGreaterThan(filter([3, 3, 3], 3, 1, 0).at(-1)!.mean)
  })
  it("forgets old games when talent can drift", () => {
    const xs = [4, 4, 4, -4, -4]
    expect(filter(xs, 2, 1, 0.5).at(-1)!.mean).toBeLessThan(filter(xs, 2, 1, 0).at(-1)!.mean)
  })
})

// Each night's games predicted from only the nights before: the form rating against the props' average leaned on the league by 3 games.
// On 2026-11-27 (3 filmed nights, 43 player-games): 16.3 against 16.8 average squared miss. When this fails, PRIOR_GAMES (or, past
// FORM_MEASURE_AT, the measured spreads) should be looked at again.
it.skipIf(!existsSync(FILE))("predicts players' next nights better than leaning their average on the league", async () => {
  const state = JSON.parse(readFileSync(FILE, "utf8")) as PooleanState
  const { setPaceGames } = await import("@/lib/per")
  setPaceGames(state.games)
  const f = await import("@/lib/form")
  const all = f.gameLines(state)
  const dates = [...new Set([...all.values()].flat().map((l) => l.date))].sort()
  let form = 0, lean = 0, n = 0
  for (const d of dates.slice(1)) {
    const before = { ...state, games: state.games.filter((g) => (g.date || "") < d) }
    const fb = f.currentForm(before)
    const byId = new Map(fb.rows.map((r) => [r.id, r]))
    const lines = f.gameLines(before)
    for (const [id, list] of all) {
      const prior = lines.get(id) ?? []
      const leaned = prior.reduce((a, x) => a + x.total, 0) / (prior.length + 3)
      for (const l of list.filter((x) => x.date === d)) {
        form += (l.total - (byId.get(id)?.mean ?? 0)) ** 2
        lean += (l.total - leaned) ** 2
        n++
      }
    }
  }
  expect(n).toBeGreaterThanOrEqual(30)
  expect(form / n).toBeLessThan(lean / n)
}, 600000)
