import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import type { Game, PooleanState } from "@/lib/types"

// The live odds with the ball (liveBall.ts), used by the game page's Odds tab, the score on the game video and the game summary for
// games with every play in order (oddsTimeline.ts), against the score-only live odds (live.ts), at the same moments: the tip and after
// every play of each complete filmed game, each called from only the nights before it. Log loss, each game counted once, lower is better.
// On 2026-11-27 (6 games): 0.438 against 0.451, and 0.442 against 0.450 at the baskets alone; PRIOR_TRIPS from 25 to 100 all beat it,
// 50 best. When this fails, the replays should go back to the score-only odds (drop the rates argument in oddsTimeline's callers) or
// PRIOR_TRIPS should be swept again. Needs public/test-data.json (never committed).
const FILE = "public/test-data.json"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const ll = (p: number, y: number) => {
  const q = Math.min(0.99, Math.max(0.01, p))
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q))
}

describe("the odds with the ball", () => {
  it("move between baskets: a turnover lowers the chance before the next basket", async () => {
    const { oddsTimeline } = await import("@/lib/oddsTimeline")
    const shot = (id: string, scorerId: string, made: boolean, videoTime: number, extra = {}) => ({ id, scorerId, points: 2 as const, made, videoTime, ...extra })
    const base = {
      id: "g", date: "2026-07-01", liveTarget: 11, teamA: ["a"], teamB: ["b"], stats: [], stealEvents: [], foulEvents: [], turnoverEvents: [],
      scoringEvents: [shot("e1", "a", true, 1), shot("e2", "b", true, 2), shot("e3", "a", true, 4)],
    } as unknown as Game
    const lost = { ...base, turnoverEvents: [{ id: "t", playerId: "a", opponentId: "b", videoTime: 3 }, { id: "t2", playerId: "b", opponentId: "a", videoTime: 3.5 }] } as unknown as Game
    const rates = { p: 0.3, share3: 0.18 }
    const plain = oddsTimeline(base, rates)
    const withTurnovers = oddsTimeline(lost, rates)
    expect(plain.ball).toBe(true)
    // Between the 2nd and 3rd baskets A turned it over and B gave it back: A has the ball again either way, but the trips taught the odds.
    expect(withTurnovers.steps[2].before).not.toBeCloseTo(plain.steps[2].before, 6)
    // Without rates (or with a play missing its time) it is the score-only odds.
    expect(oddsTimeline(base).ball).toBe(false)
  })

  it.skipIf(!existsSync(FILE))("beat the score-only live odds over every complete filmed game", async () => {
    const state = JSON.parse(readFileSync(FILE, "utf8")) as PooleanState
    const { setPaceGames } = await import("@/lib/per")
    setPaceGames(state.games)
    const m = await import("@/lib/matchup")
    m.setAppGames(state.games)
    const { liveTargetOf, winProbabilityFrom } = await import("@/lib/live")
    const { ballRates, winProbabilityWithBall } = await import("@/lib/liveBall")
    const { playValues } = await import("@/lib/epa")
    const { gameOver } = await import("@/lib/race")
    const rates = ballRates(state)
    const plays = playValues(state)
    const games = state.games.filter((g) => !g.stoppedEarly && g.scoringEvents.length > 0 && (g.winner === "A" || g.winner === "B"))
    let score = 0, ball = 0, bkScore = 0, bkBall = 0, n = 0
    for (const g of games) {
      const mine = plays.filter((p) => p.gameId === g.id)
      const fts = g.scoringEvents.filter((e) => e.points === 1 && e.made !== false)
      if (!mine.length || mine.some((p) => p.t === null) || fts.some((e) => e.videoTime == null)) continue
      type Step = { t: number; p?: (typeof mine)[number]; ft?: (typeof fts)[number] }
      const seq: Step[] = [...mine.map((p) => ({ t: p.t as number, p })), ...fts.map((e) => ({ t: e.videoTime as number, ft: e }))].sort((x, y) => x.t - y.t)
      const target = liveTargetOf(g)
      const pre = m.backtestPick(g) ?? 0.5
      const y = g.winner === "A" ? 1 : 0
      const s: number[] = [], w: number[] = [], bs: number[] = [], bw: number[] = []
      let a = 0, b = 0, nA = 0, nB = 0
      let who: "A" | "B" | null = null
      const trips = { tripsA: 0, scoredA: 0, tripsB: 0, scoredB: 0 }
      const record = (basket: boolean) => {
        const x = ll(winProbabilityFrom(a, b, target, pre, nA, nB), y)
        const z = ll(winProbabilityWithBall(a, b, target, pre, who, rates, trips), y)
        s.push(x), w.push(z)
        if (basket) bs.push(x), bw.push(z)
      }
      record(true)
      for (const st of seq) {
        if (st.ft) {
          if (g.teamA.includes(st.ft.scorerId)) a += 1
          else b += 1
        } else if (st.p) {
          const p = st.p
          const A = p.side === 0
          const trip = (scored: boolean) => (A ? (trips.tripsA++, scored && trips.scoredA++) : (trips.tripsB++, scored && trips.scoredB++))
          if (p.kind === "turnover") trip(false), (who = A ? "B" : "A")
          else if (p.end === "made") {
            if (A) (a += p.points), nA++
            else (b += p.points), nB++
            trip(true)
            who = A ? "B" : "A"
          } else if (p.end === "kept") who = A ? "A" : "B"
          else trip(false), (who = A ? "B" : "A")
        }
        if (gameOver(a, b, target)) break
        record(!!st.ft || st.p?.end === "made")
      }
      const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / xs.length
      score += avg(s), ball += avg(w), bkScore += avg(bs), bkBall += avg(bw), n++
    }
    expect(n).toBeGreaterThanOrEqual(5)
    expect(ball / n).toBeLessThan(score / n)
    expect(bkBall / n).toBeLessThan(bkScore / n)
  }, 600000)
})
