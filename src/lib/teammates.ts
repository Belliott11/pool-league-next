import { pointsAdded } from "@/lib/epa"
import { pairRecord } from "@/lib/headToHead"
import { realSeasonsInOrder } from "@/lib/real"
import type { PooleanState } from "@/lib/types"

// Who makes you better: for a player and each teammate they have played beside in filmed games, the player's Points added a game with
// that teammate on their team against without (leaning toward no difference by LEAN games of each, so two good nights together are not
// a verdict), how often the two set each other up, and their record together over every result (the old site's included). Pairs both
// ways make a pair's fit: the average of what each does for the other.

export const LEAN = 6 // a night's Points added swings by several points, so a few games together barely move it
export const MIN_TOGETHER = 2 // filmed games together (and apart) before a lift is worked out
export const MIN_RECORD = 3 // results together before a teammate is listed without filmed games

export interface Fit {
  id: string // the teammate
  together: number // filmed games on the same team
  without: number // the player's filmed games without them on their team
  withPA: number // the player's Points added a game with them
  withoutPA: number
  lift: number | null // with less without, leaned toward 0; null under MIN_TOGETHER games together or apart
  assists: number // passes between the two that became baskets, both ways
  record: [number, number] // wins and losses together, every result
}

const filmed = (state: PooleanState) => state.games.filter((g) => g.scoringEvents.length > 0 && !g.liveInProgress && !g.test)

// Every player's Points added in each filmed game, worked out once per copy of the league data.
const cache = new WeakMap<PooleanState, Map<string, Map<string, number>>>()
function perGame(state: PooleanState): Map<string, Map<string, number>> {
  const kept = cache.get(state)
  if (kept) return kept
  const out = new Map<string, Map<string, number>>() // game id -> player -> Points added
  for (const g of filmed(state)) out.set(g.id, new Map(pointsAdded(state, { only: g.id }).rows.map((r) => [r.id, r.total])))
  cache.set(state, out)
  return out
}

const fitCache = new WeakMap<PooleanState, Map<string, Fit[]>>()
export function teammateFit(state: PooleanState, pid: string): Fit[] {
  const kept = fitCache.get(state) ?? fitCache.set(state, new Map()).get(state)!
  if (!kept.has(pid)) kept.set(pid, fitFor(state, pid))
  return kept.get(pid)!
}

function fitFor(state: PooleanState, pid: string): Fit[] {
  const pa = perGame(state)
  const mine = filmed(state).filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid))
  const ids = new Set(state.players.map((p) => p.id))
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0)
  const out: Fit[] = []
  for (const m of ids) {
    if (m === pid) continue
    const record = recordTogether(state, pid, m)
    const withG: number[] = []
    const withoutG: number[] = []
    let assists = 0
    for (const g of mine) {
      const team = g.teamA.includes(pid) ? g.teamA : g.teamB
      const v = pa.get(g.id)?.get(pid) ?? 0
      if (team.includes(m)) {
        withG.push(v)
        assists += g.scoringEvents.filter((e) => e.made !== false && ((e.scorerId === pid && e.assistId === m) || (e.scorerId === m && e.assistId === pid))).length
      } else withoutG.push(v)
    }
    if (!withG.length && record[0] + record[1] < MIN_RECORD) continue
    let lift: number | null = null
    if (withG.length >= MIN_TOGETHER && withoutG.length >= MIN_TOGETHER) {
      const n = 2 / (1 / withG.length + 1 / withoutG.length) // the two sides' games, as one count
      lift = ((mean(withG) - mean(withoutG)) * n) / (n + LEAN)
    }
    out.push({ id: m, together: withG.length, without: withoutG.length, withPA: mean(withG), withoutPA: mean(withoutG), lift, assists, record })
  }
  const winShare = (f: Fit) => (f.record[0] + 1) / (f.record[0] + f.record[1] + 2)
  return out.sort((a, b) => (b.lift ?? -99) - (a.lift ?? -99) || winShare(b) - winShare(a))
}

// Wins and losses on the same team: the old site's list (which holds this site's games up to its last date), then this site's results.
export function recordTogether(state: PooleanState, x: string, y: string): [number, number] {
  const out: [number, number] = [...pairRecord(x, y).together]
  const cutoff = realSeasonsInOrder().flatMap((s) => s.games).reduce((d, r) => (r.date > d ? r.date : d), "")
  for (const g of state.games) {
    if (g.test || g.liveInProgress || g.date <= cutoff || (g.winner !== "A" && g.winner !== "B")) continue
    const team = g.teamA.includes(x) ? "A" : g.teamB.includes(x) ? "B" : null
    if (!team || !(team === "A" ? g.teamA : g.teamB).includes(y)) continue
    out[g.winner === team ? 0 : 1]++
  }
  return out
}

// A pair's fit: what each does for the other, averaged (0 when either has too few games together).
export function pairFit(state: PooleanState, a: string, b: string): number {
  const ab = teammateFit(state, a).find((f) => f.id === b)
  const ba = teammateFit(state, b).find((f) => f.id === a)
  return ab?.lift != null && ba?.lift != null ? (ab.lift + ba.lift) / 2 : 0
}

// The pairs in a team whose fit stands out (both ways), best first: for the team balancer.
export function strongPairs(state: PooleanState, team: string[], at = 0.5): { a: string; b: string; fit: number }[] {
  const out: { a: string; b: string; fit: number }[] = []
  for (let i = 0; i < team.length; i++)
    for (let j = i + 1; j < team.length; j++) {
      const fit = pairFit(state, team[i], team[j])
      if (fit >= at) out.push({ a: team[i], b: team[j], fit })
    }
  return out.sort((x, y) => y.fit - x.fit)
}
