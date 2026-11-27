import { describe, expect, it } from "vitest"
import fs from "node:fs"

const path = "public/test-data.json"
const have = fs.existsSync(path)

describe.skipIf(!have)("who makes you better (live data)", () => {
  it("is symmetric where it should be and leans small samples", async () => {
    const store: Record<string, string> = {}
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] }
    const state = JSON.parse(fs.readFileSync(path, "utf8"))
    const { setPaceGames } = await import("@/lib/per")
    setPaceGames(state.games)
    const { teammateFit, recordTogether, pairFit, MIN_TOGETHER } = await import("@/lib/teammates")
    let checked = 0
    for (const p of state.players) {
      for (const f of teammateFit(state, p.id)) {
        const back = teammateFit(state, f.id).find((x) => x.id === p.id)
        // Games together, assists between them and the record together are the same seen from either player.
        expect(back?.together).toBe(f.together)
        expect(back?.assists).toBe(f.assists)
        expect(recordTogether(state, f.id, p.id)).toEqual(f.record)
        expect(pairFit(state, p.id, f.id)).toBeCloseTo(pairFit(state, f.id, p.id), 9)
        if (f.together < MIN_TOGETHER || f.without < MIN_TOGETHER) expect(f.lift).toBeNull()
        else expect(Math.abs(f.lift!)).toBeLessThan(Math.abs(f.withPA - f.withoutPA) + 1e-9)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(0)
  }, 60000)
})
