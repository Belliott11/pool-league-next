import { countsForBeatRate, defenderShare } from "@/lib/beatRate"
import { defendersOf } from "@/lib/matchupRecord"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// Who stops whom. For every 2 or 3, who was guarding the shooter (the shot's tagged defenders, else the game's matchups list). A
// defender is judged against what the same shooters score on everyone else: points allowed per shot guarded, against those shooters'
// points per shot when anyone else guarded them. A shooter with only a few shots elsewhere leans on the league's points per shot, so
// one hot night does not decide it. Shots guarded by two people count half for each.

export const PRIOR_SHOTS = 10 // a shooter's usual points per shot leans on the league's as if they had this many more shots at it
export const MIN_PAIR_SHOTS = 4 // shots between a defender and a shooter before the pair is listed
export const MIN_RANK_SHOTS = 15 // shots guarded before a defender is ranked

const isShot = (e: ScoringEvent) => e.points === 2 || e.points === 3
const ptsOf = (e: ScoringEvent) => (e.made !== false ? e.points : 0)

export interface Pair {
  defenderId: string
  scorerId: string
  shots: number // share-weighted
  allowed: number // points scored, share-weighted
  usual: number // the shooter's points per shot against everyone else (leaning on the league)
  saved: number // (usual - allowed per shot) x shots: points kept off the board
  beaten: number // shots off a beaten defender, share-weighted
}

export interface Defender {
  id: string
  shots: number
  allowed: number
  expected: number // what the same shooters would score on those shots against anyone else
  saved10: number // points saved per 10 shots guarded
  beaten: number
  heavy: number // heavily contested shots, share-weighted
  contested: number // shots with a contest level, share-weighted
}

export interface DefenseTable {
  league: number // points per shot, every 2 and 3
  defenders: Defender[]
  pairs: Pair[]
}

export function defenseTable(state: PooleanState): DefenseTable {
  const gs: Game[] = state.games.filter(countsForBeatRate)
  // The shooter's totals over every shot, and over the shots each defender guarded, for "against everyone else".
  const shooter = new Map<string, { pts: number; shots: number }>()
  const pair = new Map<string, { pts: number; shots: number; w: number; wPts: number; beat: number }>()
  const def = new Map<string, { heavy: number; contested: number }>()
  let lp = 0
  let ls = 0
  for (const g of gs)
    for (const e of g.scoringEvents) {
      if (!isShot(e)) continue
      const p = ptsOf(e)
      lp += p
      ls++
      const s = shooter.get(e.scorerId) ?? shooter.set(e.scorerId, { pts: 0, shots: 0 }).get(e.scorerId)!
      s.pts += p
      s.shots++
      const other = g.teamA.includes(e.scorerId) ? g.teamB : g.teamA
      const guards = defendersOf(g, e).filter((d) => other.includes(d))
      const share = e.defenderIds?.length ? defenderShare(e) : 1 / Math.max(1, guards.length)
      for (const d of guards) {
        const key = `${d}|${e.scorerId}`
        const x = pair.get(key) ?? pair.set(key, { pts: 0, shots: 0, w: 0, wPts: 0, beat: 0 }).get(key)!
        x.pts += p
        x.shots++
        x.w += share
        x.wPts += p * share
        if (e.contestLevel === "beat") x.beat += share
        const c = def.get(d) ?? def.set(d, { heavy: 0, contested: 0 }).get(d)!
        if (e.contestLevel) {
          c.contested += share
          if (e.contestLevel === "heavy") c.heavy += share
        }
      }
    }
  const league = ls ? lp / ls : 0
  const pairs: Pair[] = [...pair].map(([key, x]) => {
    const [defenderId, scorerId] = key.split("|")
    const t = shooter.get(scorerId)!
    const elsewhere = { pts: t.pts - x.pts, shots: t.shots - x.shots }
    const usual = (elsewhere.pts + PRIOR_SHOTS * league) / (elsewhere.shots + PRIOR_SHOTS)
    return { defenderId, scorerId, shots: x.w, allowed: x.wPts, usual, saved: usual * x.w - x.wPts, beaten: x.beat }
  })
  const by = new Map<string, Defender>()
  for (const p of pairs) {
    const d = by.get(p.defenderId) ?? by.set(p.defenderId, { id: p.defenderId, shots: 0, allowed: 0, expected: 0, saved10: 0, beaten: 0, heavy: 0, contested: 0 }).get(p.defenderId)!
    d.shots += p.shots
    d.allowed += p.allowed
    d.expected += p.usual * p.shots
    d.beaten += p.beaten
  }
  for (const d of by.values()) {
    d.saved10 = d.shots ? ((d.expected - d.allowed) / d.shots) * 10 : 0
    const c = def.get(d.id)
    d.heavy = c?.heavy ?? 0
    d.contested = c?.contested ?? 0
  }
  return { league, defenders: [...by.values()].sort((a, b) => b.saved10 - a.saved10), pairs }
}

// Where one player stands, as a defender and as a shooter.
export function playerDefense(t: DefenseTable, id: string) {
  const me = t.defenders.find((d) => d.id === id) ?? null
  const ranked = t.defenders.filter((d) => d.shots >= MIN_RANK_SHOTS)
  const rank = ranked.findIndex((d) => d.id === id)
  const perShot = (p: Pair) => p.saved / p.shots
  const guarding = t.pairs.filter((p) => p.defenderId === id && p.shots >= MIN_PAIR_SHOTS).sort((a, b) => perShot(b) - perShot(a))
  const guardedBy = t.pairs.filter((p) => p.scorerId === id && p.shots >= MIN_PAIR_SHOTS).sort((a, b) => perShot(b) - perShot(a))
  return { me, rank: rank >= 0 ? rank + 1 : null, ranked: ranked.length, guarding, guardedBy }
}
