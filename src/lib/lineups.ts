import { results, type Result } from "@/lib/winImpact"
import type { PooleanState } from "@/lib/types"

// Records for players who shared a team: every pair and every trio, over every result (filmed or not). The rate is pulled toward
// even by 5 phantom games, the same as the duo awards, so 9-1 ranks above 3-0.
export const PAIR_MIN = 4
export const TRIO_MIN = 3

export interface Lineup {
  ids: string[]
  gp: number
  w: number
  rate: number
}

const combos = (ids: string[], k: number): string[][] => (k === 0 ? [[]] : ids.flatMap((id, i) => combos(ids.slice(i + 1), k - 1).map((rest) => [id, ...rest])))

export function lineups(rows: Result[], size: 2 | 3, min = size === 2 ? PAIR_MIN : TRIO_MIN): Lineup[] {
  const seen = new Map<string, Lineup>()
  for (const r of rows)
    for (const [team, won] of [[r.a, r.aWon], [r.b, !r.aWon]] as const)
      for (const ids of combos([...team].sort(), size)) {
        const k = ids.join("|")
        const l = seen.get(k) ?? { ids, gp: 0, w: 0, rate: 0 }
        l.gp++
        if (won) l.w++
        seen.set(k, l)
      }
  return [...seen.values()]
    .filter((l) => l.gp >= min)
    .map((l) => ({ ...l, rate: (l.w + 2.5) / (l.gp + 5) }))
    .sort((a, b) => b.rate - a.rate || b.gp - a.gp)
}

export const leagueLineups = (state: PooleanState, size: 2 | 3) => lineups(results(state), size)
