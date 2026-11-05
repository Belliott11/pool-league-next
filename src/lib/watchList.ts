import { oldSite, type OldSite } from "@/lib/oldSite"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import { seasonGames } from "@/lib/offseason"
import type { PooleanState } from "@/lib/types"

// Who to watch next season, from how each player finished against how they started. Four kinds of evidence, each
// compared first half against second half of that player's own record:
//   twoWay   two-way per 25 over box-scored games
//   scoring  points per 25 over every game, used only when a player has too few box-scored games
//   wins     win rate over the old site's results (most games were never filmed)
//   power    the old site's nightly power ranking percentile
// With this few games it is a hint, not a forecast.
export type Kind = "twoWay" | "scoring" | "wins" | "power"
export const MIN_N: Record<Kind, number> = { twoWay: 4, scoring: 4, wins: 8, power: 4 }
export const SWING: Record<Kind, number> = { twoWay: 1.25, scoring: 2, wins: 0.25, power: 15 } // how far a half must move to count

export interface Signal {
  kind: Kind
  n: number
  early: number
  late: number
  season: number
  dir: 1 | -1 | 0
  strong: boolean // whole-season level at or above the middle
}

export interface Watch {
  id: string
  signals: Signal[] // only the ones that moved
  strong: boolean // most of this player's whole-season levels sit at or above the middle
  score: number // how far the moving signals moved, in units of their own swing size
}

export interface WatchList {
  rising: Watch[]
  bounce: Watch[]
  rated: number // players with at least one comparison to make
}

interface Row {
  v: number
  total: number
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const per25 = (rows: Row[]) => {
  const total = rows.reduce((n, r) => n + r.total, 0)
  return total > 0 ? (rows.reduce((n, r) => n + r.v, 0) / total) * 20 : 0
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : 0
}
const halves = <T,>(xs: T[]): [T[], T[]] => [xs.slice(0, Math.floor(xs.length / 2)), xs.slice(Math.floor(xs.length / 2))]

export function watchList(state: PooleanState, limit = 3, old: OldSite = oldSite()): WatchList {
  const known = new Set(state.players.map((p) => p.id))
  const box = new Map<string, Row[]>()
  const every = new Map<string, Row[]>()
  for (const g of seasonGames(state)) {
    const [a, b] = scoreOf(g)
    for (const id of [...g.teamA, ...g.teamB]) {
      const line = playerLine(g, id)
      every.set(id, [...(every.get(id) ?? []), { v: line.pts, total: a + b }])
      if (g.scoringEvents.length > 0 && line.twoWay !== null) box.set(id, [...(box.get(id) ?? []), { v: line.twoWay, total: a + b }])
    }
  }

  type Raw = Omit<Signal, "dir" | "strong">
  const raw = new Map<string, Raw[]>()
  const add = (id: string, r: Raw) => raw.set(id, [...(raw.get(id) ?? []), r])
  const fromRows = (kind: Kind, id: string, rows: Row[]) => {
    if (rows.length < MIN_N[kind]) return false
    const [e, l] = halves(rows)
    add(id, { kind, n: rows.length, early: per25(e), late: per25(l), season: per25(rows) })
    return true
  }
  const fromList = (kind: Kind, id: string, xs: number[], season = mean(xs)) => {
    if (xs.length < MIN_N[kind]) return
    const [e, l] = halves(xs)
    add(id, { kind, n: xs.length, early: mean(e), late: mean(l), season })
  }
  for (const id of known) {
    if (!fromRows("twoWay", id, box.get(id) ?? [])) fromRows("scoring", id, every.get(id) ?? [])
    fromList("wins", id, (old.wins.get(id) ?? []).map(Number))
    fromList("power", id, old.ranks.get(id) ?? [], old.power.get(id))
  }

  // The middle of the league for the two per-25 kinds; 50% for wins; 50 for power.
  const mid: Record<Kind, number> = { twoWay: 0, scoring: 0, wins: 0.5, power: 50 }
  for (const k of ["twoWay", "scoring"] as const) mid[k] = median([...raw.values()].flat().filter((r) => r.kind === k).map((r) => r.season))

  const all: Watch[] = []
  for (const [id, rs] of raw) {
    const signals: Signal[] = rs.map((r) => {
      const d = r.late - r.early
      return { ...r, dir: d >= SWING[r.kind] ? 1 : d <= -SWING[r.kind] ? -1 : 0, strong: r.season >= mid[r.kind] }
    })
    all.push({
      id,
      signals: signals.filter((s) => s.dir !== 0),
      strong: signals.filter((s) => s.strong).length * 2 >= signals.length,
      score: signals.reduce((n, s) => n + Math.abs(s.late - s.early) / SWING[s.kind] * (s.dir !== 0 ? 1 : 0), 0),
    })
  }
  const up = (w: Watch) => w.signals.filter((s) => s.dir > 0).length
  const down = (w: Watch) => w.signals.filter((s) => s.dir < 0).length
  const best = (a: Watch, b: Watch) => Math.max(up(b), down(b)) - Math.max(up(a), down(a)) || b.score - a.score
  return {
    rising: all.filter((w) => up(w) > 0 && down(w) === 0).sort(best).slice(0, limit),
    bounce: all.filter((w) => down(w) > 0 && up(w) === 0 && w.strong).sort(best).slice(0, limit),
    rated: all.length,
  }
}
