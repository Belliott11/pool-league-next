import { ballRates } from "@/lib/liveBall"
import { oddsTimeline } from "@/lib/oddsTimeline"
import type { Game, PooleanState } from "@/lib/types"

// How dramatic a game was, from its win chance basket by basket (oddsTimeline.ts: the odds that know who had the ball when every play is
// in order, else the live odds). The score is the sports-analytics "excitement index": the total of every basket's swing in win chance,
// so a game that lurched back and forth scores high and a wire-to-wire win scores low. Beside it, the facts that make a game worth
// rewatching: how far the winner came back from, how often the lead changed, and whether it was still anyone's game late.

export interface Drama {
  gameId: string
  date: string
  score: number // total swing, in whole games of win chance; shown times 100 (the odds moved 190 points in all)
  comeback: number // the winner's lowest chance during the game (0 to 1)
  leadChanges: number
  lateDoubt: boolean // in the last quarter of the baskets, the winner's chance was 60% or under at some point
  winner: "A" | "B"
}

export function gameDrama(game: Game, state: PooleanState): Drama | null {
  const t = oddsTimeline(game, ballRates(state))
  if (t.steps.length < 4) return null
  const last = t.steps[t.steps.length - 1]
  const winner: "A" | "B" = last.a > last.b ? "A" : last.b > last.a ? "B" : last.after >= 0.5 ? "A" : "B"
  const forWinner = (pA: number) => (winner === "A" ? pA : 1 - pA)
  let score = 0
  let lowest = forWinner(t.start)
  let leader = 0
  let changes = 0
  for (const s of t.steps) {
    score += Math.abs(s.after - s.before)
    lowest = Math.min(lowest, forWinner(s.before))
    const lead = Math.sign(s.a - s.b)
    if (lead !== 0) {
      if (leader !== 0 && lead !== leader) changes++
      leader = lead
    }
  }
  const lateFrom = Math.floor(t.steps.length * 0.75)
  const lateDoubt = t.steps.slice(lateFrom).some((s) => forWinner(s.before) <= 0.6)
  return { gameId: game.id, date: game.date, score, comeback: lowest, leadChanges: changes, lateDoubt, winner }
}

// Every finished game with enough baskets, most dramatic first.
export function dramaRanking(state: PooleanState): Drama[] {
  return state.games
    .filter((g) => !g.liveInProgress && !g.test)
    .map((g) => gameDrama(g, state))
    .filter((d): d is Drama => !!d)
    .sort((a, b) => b.score - a.score)
}

// The facts in words, for the game page and the lists.
export function dramaWords(d: Drama): string[] {
  const out: string[] = []
  if (d.comeback <= 0.3) out.push(`the winners came back from a ${Math.round(d.comeback * 100)}% chance`)
  if (d.leadChanges >= 2) out.push(`the lead changed ${d.leadChanges} times`)
  if (d.lateDoubt) out.push("still anyone's game late")
  return out
}
