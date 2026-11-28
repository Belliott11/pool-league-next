import { describe, expect, it } from "vitest"
import fs from "node:fs"

const path = "public/test-data.json"

describe.skipIf(!fs.existsSync(path))("dream matchup (live data)", () => {
  it("plays games that add up and win about as often as the chance says", async () => {
    const store: Record<string, string> = {}
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] }
    const state = JSON.parse(fs.readFileSync(path, "utf8"))
    const { dreamMatchup, dreamKey, parseDreamKey } = await import("@/lib/dreamMatchup")
    const A = ["ben", "evan", "adam"]
    const B = ["zach", "alex", "g-ian"]
    const d = dreamMatchup(state, A, B)
    expect(d.chance).toBeGreaterThan(0.02)
    expect(d.chance).toBeLessThan(0.98)
    // Every simulated game ends at the target, won by 2, and the box score adds up to the final.
    let wins = 0
    const N = 600
    for (let k = 0; k < N; k++) {
      const g = dreamMatchup(state, A, B, k).game
      const pts = (team: string[]) => g.lines.filter((l) => team.includes(l.id)).reduce((s, l) => s + l.points, 0)
      expect(pts(A)).toBe(g.a)
      expect(pts(B)).toBe(g.b)
      expect(Math.max(g.a, g.b)).toBeGreaterThanOrEqual(d.target)
      expect(Math.abs(g.a - g.b)).toBeGreaterThanOrEqual(2)
      if (g.a > g.b) wins++
    }
    // Within about three standard errors of the chance at the tip.
    const se = Math.sqrt((d.chance * (1 - d.chance)) / N)
    expect(Math.abs(wins / N - d.chance)).toBeLessThan(3 * se + 0.01)
    // The same matchup and replay number give the same game on every phone.
    expect(dreamMatchup(state, A, B, 3).game).toEqual(dreamMatchup(state, A, B, 3).game)
    // Addresses round-trip, with hyphenated ids.
    const ids = new Set<string>(state.players.map((p: { id: string }) => p.id))
    expect(parseDreamKey(dreamKey(A, B), ids)).toEqual([A, B])
  }, 120000)
})
