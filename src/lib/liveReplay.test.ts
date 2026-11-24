import { existsSync, readFileSync } from "node:fs"
import { expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"

// Checks the live odds' PREGAME_WEIGHT_LIVE (live.ts) against every game on record, each called from only the nights before it: the results
// that were never filmed at their opening moment (at 0-0 the live odds are exactly the weighted pre-game read), and the complete filmed
// games at every moment, basket by basket. Each game counts once. The shipped weight must beat both the full read and starting at 50/50;
// when new games make it fail, rerun the sweep in the CLAUDE.md "Live win probability" notes. Needs public/test-data.json (never committed).
const FILE = "public/test-data.json"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const ll = (p: number, y: number) => {
  const q = Math.min(0.99, Math.max(0.01, p))
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q))
}

it.skipIf(!existsSync(FILE))("the live odds' pre-game weight beats the full read and 50/50 over every game on record", async () => {
  const state = JSON.parse(readFileSync(FILE, "utf8")) as PooleanState
  const { setPaceGames } = await import("@/lib/per")
  setPaceGames(state.games)
  const m = await import("@/lib/matchup")
  m.setAppGames(state.games)
  const { liveTargetOf, winProbabilityFrom, PREGAME_WEIGHT_LIVE } = await import("@/lib/live")
  const { gameOver } = await import("@/lib/race")
  const { realSeasonsInOrder } = await import("@/lib/real")

  const filmed = state.games.filter((g) => !g.stoppedEarly && g.scoringEvents.length > 0 && (g.winner === "A" || g.winner === "B"))
  const key = (date: string, a: string[], b: string[]) => `${date}|${[...a].sort()}|${[...b].sort()}`
  const filmedKeys = new Set(filmed.flatMap((g) => [key(g.date, g.teamA, g.teamB), key(g.date, g.teamB, g.teamA)]))
  const unfilmed = realSeasonsInOrder()
    .flatMap((s) => s.games)
    .filter((g) => !filmedKeys.has(key(g.date, g.a, g.b)))
    .map((g, i) => ({ y: g.w === "A" ? 1 : 0, p: m.backtestPick({ id: `old-${i}`, date: g.date, teamA: g.a, teamB: g.b } as unknown as Game) }))
    .filter((r): r is { y: number; p: number } => r.p !== undefined)

  // `lean` is how much of the read the odds start from; winProbabilityFrom applies PREGAME_WEIGHT_LIVE itself, so it is undone first.
  const average = (lean: number) => {
    const asInput = (read: number) => 0.5 + (lean * (read - 0.5)) / PREGAME_WEIGHT_LIVE
    let total = 0
    for (const r of unfilmed) total += ll(winProbabilityFrom(0, 0, 16, asInput(r.p)), r.y)
    for (const g of filmed) {
      const target = liveTargetOf(g)
      const pre = asInput(m.backtestPick(g) ?? 0.5)
      const y = g.winner === "A" ? 1 : 0
      let a = 0, b = 0, nA = 0, nB = 0
      const moments = [ll(winProbabilityFrom(0, 0, target, pre), y)]
      for (const e of g.scoringEvents.filter((x) => x.made !== false)) {
        if (g.teamA.includes(e.scorerId)) (a += e.points), nA++
        else (b += e.points), nB++
        if (gameOver(a, b, target)) break
        moments.push(ll(winProbabilityFrom(a, b, target, pre, nA, nB), y))
      }
      total += moments.reduce((s, x) => s + x, 0) / moments.length
    }
    return total / (unfilmed.length + filmed.length)
  }
  const shipped = average(PREGAME_WEIGHT_LIVE)
  expect(unfilmed.length + filmed.length).toBeGreaterThanOrEqual(30)
  expect(shipped).toBeLessThan(average(1)) // the full read
  expect(shipped).toBeLessThan(average(0)) // 50/50
}, 300000)
