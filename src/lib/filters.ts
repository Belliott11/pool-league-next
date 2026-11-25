import type { Game } from "@/lib/types"

// The filters from the Filters menu, read by every panel and stat so they all count the same games. App sets them each time the
// choice changes (see App.tsx); the classic layer is set from the same choice (see legacy.ts), so the two always agree.
//
// Not covered, on purpose: analyses whose whole point is team size (By format, Win impact's team-size effect, the bigger-team rule on
// Does it hold up?) always use every game, and the pace baseline (see per.ts) always uses full even-team games so it never shifts.
export interface Filters {
  imbalanced: boolean // count uneven teams, like 3 against 2
  outliers: boolean // count a player's statistical outlier games (when off, those are left out of that player's stats)
  currentRules?: boolean // count only games under the current rulebook (rulebook.ts); the written text steps aside when on
}

export const DEFAULT_FILTERS: Filters = { imbalanced: false, outliers: true }

// Outlier games count by default while the league is small; from this many filmed games they are left out by default, since a player's
// unusual nights then say less about them than the rest of their games do. A choice made in the Filters menu always wins.
export const OUTLIERS_OFF_AT = 20
let filmedGames = 0
export function setFilmedGames(n: number) {
  filmedGames = n
}
export const filmedGameCount = () => filmedGames
export const defaultFilters = (): Filters => ({ imbalanced: false, outliers: filmedGames < OUTLIERS_OFF_AT })

let current: Filters = DEFAULT_FILTERS

export function setFilters(f: Partial<Filters>) {
  current = { ...current, ...f }
}
export const filters = () => current
export const isDefaultFilters = (f: Filters = current) => {
  const d = defaultFilters()
  return f.imbalanced === d.imbalanced && f.outliers === d.outliers && !f.currentRules
}

export const isEvenGame = (g: Game) => g.teamA.length === g.teamB.length

// Whether the "Include imbalanced games" filter lets this game's team sizes in.
export const sizeAllowed = (g: Game) => current.imbalanced || isEvenGame(g)

// 1.5 times the middle half's width beyond the middle half: the same outlier rule the classic site used. Needs 4 games to judge.
export const OUTLIER_MIN_GAMES = 4
function quantile(sorted: number[], q: number) {
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}
// Which of these values sit inside the fences (true) and which are outliers (false), in the same order.
export function insideFences(values: number[]): boolean[] {
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  return values.map((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
}
