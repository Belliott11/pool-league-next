import { defenseTable, MIN_PAIR_SHOTS, type DefenseTable } from "@/lib/playerDefense"
import type { Game, PooleanState } from "@/lib/types"

// Who should guard whom tonight: for each team, the matchups that keep the most points off the board, from "Who stops whom"
// (src/lib/playerDefense.ts). A pair's points saved per shot leans toward zero by LEAN shots, so four lucky shots do not decide it;
// a pair that has never met uses the defender's overall rate at half weight. Each shooter's value is weighted by how many shots they
// take a game, so the best stopper goes to whoever shoots most. Teams of up to 6 are tried every way. Only a suggestion: it sets
// nothing, and the live screens show it until the first basket.
export const LEAN = 6

export interface GuardCall {
  defenderId: string
  scorerId: string
  perShot: number // points per shot held under the shooter's usual (negative: over it)
  shots: number // shots between them so far (0: never met)
}

export interface GuardPlan {
  forA: GuardCall[] // Team A defending Team B's shooters
  forB: GuardCall[]
}

function shotsPerGame(state: PooleanState): Map<string, number> {
  const shots = new Map<string, number>()
  const games = new Map<string, number>()
  for (const g of state.games) {
    if (!g.scoringEvents?.length) continue
    for (const p of [...g.teamA, ...g.teamB]) games.set(p, (games.get(p) ?? 0) + 1)
    for (const e of g.scoringEvents) if (e.points === 2 || e.points === 3) shots.set(e.scorerId, (shots.get(e.scorerId) ?? 0) + 1)
  }
  const out = new Map<string, number>()
  for (const [p, n] of games) out.set(p, (shots.get(p) ?? 0) / n)
  return out
}

function rate(t: DefenseTable, d: string, s: string): { perShot: number; shots: number } {
  const p = t.pairs.find((x) => x.defenderId === d && x.scorerId === s)
  if (p && p.shots > 0) return { perShot: p.saved / (p.shots + LEAN), shots: p.shots }
  const me = t.defenders.find((x) => x.id === d)
  return { perShot: me && me.shots ? ((me.expected - me.allowed) / (me.shots + LEAN)) * 0.5 : 0, shots: 0 }
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]))
}

// Best assignment of defenders to shooters (each shooter guarded once; with an extra player, someone is left free or doubles nobody).
function assign(t: DefenseTable, vol: Map<string, number>, defenders: string[], shooters: string[]): GuardCall[] {
  if (!defenders.length || !shooters.length || defenders.length > 6 || shooters.length > 6) return []
  const n = Math.min(defenders.length, shooters.length)
  const avgVol = [...vol.values()].reduce((a, b) => a + b, 0) / Math.max(1, vol.size) || 1
  let best: GuardCall[] = []
  let bestScore = -Infinity
  // Order shooters every way and pair them with the defenders in order; the longer side's leftovers sit out.
  const longD = defenders.length >= shooters.length
  for (const perm of permutations(longD ? defenders : shooters)) {
    const calls: GuardCall[] = []
    let score = 0
    for (let i = 0; i < n; i++) {
      const d = longD ? perm[i] : defenders[i]
      const s = longD ? shooters[i] : perm[i]
      const r = rate(t, d, s)
      score += r.perShot * (vol.get(s) ?? avgVol)
      calls.push({ defenderId: d, scorerId: s, ...r })
    }
    if (score > bestScore + 1e-9) {
      bestScore = score
      best = calls
    }
  }
  return best.sort((a, b) => b.perShot - a.perShot)
}

export function guardPlan(state: PooleanState, game: Pick<Game, "teamA" | "teamB">, table: DefenseTable = defenseTable(state)): GuardPlan {
  const vol = shotsPerGame(state)
  return { forA: assign(table, vol, game.teamA, game.teamB), forB: assign(table, vol, game.teamB, game.teamA) }
}

// Only worth showing when at least one call rests on real history between the two.
export const hasHistory = (p: GuardPlan) => [...p.forA, ...p.forB].some((c) => c.shots >= MIN_PAIR_SHOTS)
