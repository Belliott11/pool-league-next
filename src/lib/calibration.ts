import { liveTargetOf, winProbabilityFrom } from "@/lib/live"
import { backtestPick } from "@/lib/matchup"
import { realSeasonsInOrder } from "@/lib/real"
import { gameOver } from "@/lib/race"
import type { Game, PooleanState } from "@/lib/types"

// Do the live odds mean what they say? Every moment the odds were given, grouped by how sure they were, against how often the favored
// team actually won. The same moments as src/lib/liveReplay.test.ts: results that were never filmed at their opening moment, and the
// filmed games basket by basket, each game counting once in all (its moments share one game's weight). Every call is made from only
// the nights before the game.

export interface Band {
  label: string
  lo: number
  hi: number
  weight: number // games' worth of moments in this band
  moments: number
  said: number // the odds' average chance for the favored team, 0 to 1
  won: number // how often the favored team won, 0 to 1
}

const BANDS: [number, number][] = [
  [0.5, 0.6],
  [0.6, 0.7],
  [0.7, 0.8],
  [0.8, 0.9],
  [0.9, 1.0001],
]

export function calibration(state: PooleanState): { bands: Band[]; games: number } {
  const acc = BANDS.map(([lo, hi]) => ({ lo, hi, w: 0, n: 0, said: 0, won: 0 }))
  const add = (p: number, y: number, w: number) => {
    // The favored team's view, so 30% for A is 70% for B.
    const fav = p >= 0.5 ? p : 1 - p
    const won = p >= 0.5 ? y : 1 - y
    const b = acc.find((x) => fav >= x.lo && fav < x.hi)
    if (!b) return
    b.w += w
    b.n++
    b.said += fav * w
    b.won += won * w
  }
  const filmed = state.games.filter((g) => !g.liveInProgress && !g.stoppedEarly && g.scoringEvents.length > 0 && (g.winner === "A" || g.winner === "B"))
  const key = (date: string, a: string[], b: string[]) => `${date}|${[...a].sort()}|${[...b].sort()}`
  const filmedKeys = new Set(filmed.flatMap((g) => [key(g.date, g.teamA, g.teamB), key(g.date, g.teamB, g.teamA)]))
  let games = 0
  realSeasonsInOrder()
    .flatMap((s) => s.games)
    .filter((g) => !filmedKeys.has(key(g.date, g.a, g.b)))
    .forEach((g, i) => {
      const pre = backtestPick({ id: `old-${i}`, date: g.date, teamA: g.a, teamB: g.b } as unknown as Game)
      if (pre === undefined) return
      games++
      add(winProbabilityFrom(0, 0, 16, pre), g.w === "A" ? 1 : 0, 1)
    })
  for (const g of filmed) {
    const target = liveTargetOf(g)
    const pre = backtestPick(g) ?? null
    const y = g.winner === "A" ? 1 : 0
    const moments = [winProbabilityFrom(0, 0, target, pre)]
    let a = 0, b = 0, nA = 0, nB = 0
    for (const e of g.scoringEvents.filter((x) => x.made !== false)) {
      if (g.teamA.includes(e.scorerId)) (a += e.points), nA++
      else if (g.teamB.includes(e.scorerId)) (b += e.points), nB++
      else continue
      if (gameOver(a, b, target)) break
      moments.push(winProbabilityFrom(a, b, target, pre, nA, nB))
    }
    games++
    for (const p of moments) add(p, y, 1 / moments.length)
  }
  return {
    games,
    bands: acc.map((b) => ({ label: `${Math.round(b.lo * 100)}-${Math.min(100, Math.round(b.hi * 100))}%`, lo: b.lo, hi: b.hi, weight: b.w, moments: b.n, said: b.w ? b.said / b.w : 0, won: b.w ? b.won / b.w : 0 })),
  }
}
