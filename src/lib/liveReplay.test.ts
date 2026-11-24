import { existsSync, readFileSync } from "node:fs"
import { expect, it, vi } from "vitest"
import type { PooleanState } from "@/lib/types"

// Replays every complete filmed game basket by basket through the live odds (winProbabilityFrom) and scores each moment against who won,
// with each game's pre-game read taken from only the games before it. It checks the shipped PREGAME_WEIGHT_LIVE still beats using the full
// read; when new games make it fail, revisit that setting (see live.ts). Needs public/test-data.json (a copy of live state, never committed).
const FILE = "public/test-data.json"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })

it.skipIf(!existsSync(FILE))("the live odds' pre-game weight beats the full pre-game read on the filmed games", async () => {
  const state = JSON.parse(readFileSync(FILE, "utf8")) as PooleanState
  const { setPaceGames } = await import("@/lib/per")
  setPaceGames(state.games)
  const m = await import("@/lib/matchup")
  m.setAppGames(state.games)
  const { liveTargetOf, winProbabilityFrom, PREGAME_WEIGHT_LIVE } = await import("@/lib/live")
  const { gameOver } = await import("@/lib/race")
  const games = state.games.filter((g) => !g.stoppedEarly && g.scoringEvents.length > 0 && (g.winner === "A" || g.winner === "B"))
  const replay = (scalePre: (pre: number) => number) => {
    let loss = 0, n = 0
    for (const g of games) {
      const target = liveTargetOf(g)
      const pre = scalePre(m.backtestPick(g) ?? 0.5)
      const y = g.winner === "A" ? 1 : 0
      let a = 0, b = 0, nA = 0, nB = 0
      const add = () => {
        const p = Math.min(0.99, Math.max(0.01, winProbabilityFrom(a, b, target, pre, nA, nB)))
        loss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p))
        n++
      }
      add()
      for (const e of g.scoringEvents.filter((x) => x.made !== false)) {
        if (g.teamA.includes(e.scorerId)) (a += e.points), nA++
        else (b += e.points), nB++
        if (gameOver(a, b, target)) break
        add()
      }
    }
    return loss / n
  }
  const shipped = replay((pre) => pre)
  // The full read: undo the weight, so winProbabilityFrom starts from the whole lean.
  const full = replay((pre) => 0.5 + (pre - 0.5) / PREGAME_WEIGHT_LIVE)
  expect(games.length).toBeGreaterThanOrEqual(5)
  expect(shipped).toBeLessThan(full)
  expect(shipped).toBeLessThan(Math.log(2)) // and beats a coin flip
}, 120000)
