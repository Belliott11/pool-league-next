import { describe, expect, it } from "vitest"
import fs from "node:fs"

const path = "public/test-data.json"

describe.skipIf(!fs.existsSync(path))("award odds (live data)", () => {
  it("adds up, follows the race, and settles when no nights are left", async () => {
    const store: Record<string, string> = {}
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] }
    const state = JSON.parse(fs.readFileSync(path, "utf8"))
    const { setPaceGames } = await import("@/lib/per")
    setPaceGames(state.games)
    const { awardOdds, ODDS_KEYS } = await import("@/lib/awardOdds")
    const { awardRace } = await import("@/lib/awardRace")
    const now = awardOdds(state, { planned: 0, runs: 200 })!
    expect(now.nightsLeft).toBe(0)
    const race = awardRace(state)
    for (const key of ODDS_KEYS) {
      const leader = race.find((r) => r.key === key)?.leaders[0]?.ids[0]
      // No nights left: the race's leader has it.
      if (leader) expect(now.odds[key][0]).toMatchObject({ id: leader, chance: 1 })
    }
    const later = awardOdds(state, { planned: now.nightsPlayed + 8, runs: 1500 })!
    expect(later.nightsLeft).toBe(8)
    for (const key of ODDS_KEYS) {
      const total = later.odds[key].reduce((s, x) => s + x.chance, 0)
      expect(total).toBeCloseTo(1, 6)
      // With nights left the leader is not certain, and still the favourite.
      const leader = race.find((r) => r.key === key)?.leaders[0]?.ids[0]
      if (leader) {
        expect(later.odds[key][0].chance).toBeLessThan(1)
        expect(later.odds[key].slice(0, 2).map((x) => x.id)).toContain(leader)
      }
    }
    fs.writeFileSync("/tmp/claude-0/-home-user/0452290a-e7ed-5596-989c-36610eec3ef1/scratchpad/odds.json", JSON.stringify({ race: race.filter((r) => ["mvp", "best-player", "dpoy"].includes(r.key)), later }, null, 1))
  }, 120000)
})
