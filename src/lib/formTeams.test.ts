import { existsSync, readFileSync } from "node:fs"
import { expect, it, vi } from "vitest"
import type { PooleanState } from "@/lib/types"

vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const FILE = "public/test-data.json"

// Keeps the balancer question honest: form and the pre-game read are each scored on games they called from earlier nights only. On
// 2026-11-27: 8 games, form 5, the read 4 (too few to switch; READY_AT is 30).
it.skipIf(!existsSync(FILE))("scores the form rating against the pre-game read on every game both could call", async () => {
  const state = JSON.parse(readFileSync(FILE, "utf8")) as PooleanState
  const { setPaceGames } = await import("@/lib/per")
  setPaceGames(state.games)
  const m = await import("@/lib/matchup")
  m.setAppGames(state.games)
  const { formVsRead, teamForm } = await import("@/lib/formTeams")
  const r = formVsRead(state)
  expect(r.games).toBeGreaterThanOrEqual(5)
  expect(r.formRight).toBeLessThanOrEqual(r.games)
  expect(r.readRight).toBeLessThanOrEqual(r.games)
  expect(teamForm(state, ["nobody"])).toBe(0)
}, 300000)
