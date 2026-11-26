import { standings } from "@/lib/seasonTeams"
import type { PooleanState, SeasonTeam, SeasonTeamSet } from "@/lib/types"

// Season title odds: each team's chance of finishing first, by playing out the nights left many times. A team's own nights so far say how
// good it is, leaned on the league's average by PRIOR_NIGHTS nights (one great opening night is not a title); each simulated night is that
// team's level plus the night-to-night spread seen across every team's nights, with the uncertainty in the level drawn once per run. The
// title goes to the best average over every night, as the standings rank it. Seeded, so the same data always shows the same numbers.

export const DEFAULT_NIGHTS = 12 // last summer had 10 nights of results and 15 parties
export const PRIOR_NIGHTS = 3
const RUNS = 4000
const FALLBACK_SPREAD = 0.3

export interface TitleLine {
  team: SeasonTeam
  odds: number // 0 to 1
  change: number | null // since before the latest night
}

export interface TitleOdds {
  played: number
  planned: number
  left: number
  lines: TitleLine[] // best first
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function oddsNow(state: PooleanState, set: SeasonTeamSet): { played: number; planned: number; odds: Map<string, number> } {
  const s = standings(state, set)
  const per = new Map<string, number[]>(set.teams.map((t) => [t.id, []]))
  for (const n of s.nights) for (const x of n.scores) per.get(x.team.id)?.push(x.score)
  const played = s.nights.length
  const planned = Math.max(set.nights ?? DEFAULT_NIGHTS, played)
  const left = planned - played
  const all = [...per.values()].flat()
  const league = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0
  let ss = 0
  let df = 0
  for (const list of per.values()) {
    if (list.length < 2) continue
    const m = list.reduce((a, b) => a + b, 0) / list.length
    ss += list.reduce((a, b) => a + (b - m) ** 2, 0)
    df += list.length - 1
  }
  const spread = df >= 3 ? Math.sqrt(ss / df) : FALLBACK_SPREAD
  const wins = new Map<string, number>(set.teams.map((t) => [t.id, 0]))
  if (left === 0) {
    const top = s.rows[0]
    if (top) wins.set(top.team.id, RUNS)
  } else {
    const seed = Math.round(all.reduce((a, b) => a + b * 1000, 0) + played * 7919 + set.teams.length)
    const r = rng(seed)
    const normal = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r())
    const teams = set.teams.map((t) => {
      const list = per.get(t.id)!
      const sum = list.reduce((a, b) => a + b, 0)
      return { id: t.id, sum, n: list.length, level: (sum + league * PRIOR_NIGHTS) / (list.length + PRIOR_NIGHTS), sure: spread / Math.sqrt(list.length + PRIOR_NIGHTS) }
    })
    for (let run = 0; run < RUNS; run++) {
      let best = -Infinity
      let bestId = ""
      for (const t of teams) {
        const level = t.level + normal() * t.sure
        let total = t.sum
        for (let k = 0; k < left; k++) total += level + normal() * spread
        const avg = total / planned
        if (avg > best) {
          best = avg
          bestId = t.id
        }
      }
      wins.set(bestId, wins.get(bestId)! + 1)
    }
  }
  return { played, planned, odds: new Map([...wins].map(([k, v]) => [k, v / RUNS])) }
}

export function titleOdds(state: PooleanState, set: SeasonTeamSet): TitleOdds {
  const now = oddsNow(state, set)
  // The same, as it stood before the latest night.
  const nights = standings(state, set).nights
  const last = nights.at(-1)?.date
  const before = last ? oddsNow({ ...state, games: state.games.filter((g) => (g.date || "") < last) }, set) : null
  const lines = set.teams
    .map((team) => ({ team, odds: now.odds.get(team.id) ?? 0, change: before && before.played > 0 ? (now.odds.get(team.id) ?? 0) - (before.odds.get(team.id) ?? 0) : null }))
    .sort((a, b) => b.odds - a.odds)
  return { played: now.played, planned: now.planned, left: now.planned - now.played, lines }
}
