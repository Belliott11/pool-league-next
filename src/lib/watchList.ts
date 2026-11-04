import { playerLine, scoreOf } from "@/lib/nightRecap"
import { seasonGames } from "@/lib/offseason"
import type { PooleanState } from "@/lib/types"

// Who to watch next season, from how each player did late in the season against early in it. It only uses games with a
// box score, and a player needs enough of them to split in two. With this few games it is a hint, not a forecast.
export const MIN_GAMES = 4
export const MIN_SWING = 1 // two-way per 20 a player must move by to be listed

export interface Watch {
  id: string
  games: number
  early: number // two-way per 20 over the first half of their games
  late: number // and over the second half
  season: number // over all of them
  delta: number // late minus early
}

export interface WatchList {
  rising: Watch[]
  bounce: Watch[]
  rated: number // players with enough games to be looked at
}

// Two-way per 20 combined points over some games: the same pace adjustment as the standings.
const per20 = (rows: { tw: number; total: number }[]) => {
  const total = rows.reduce((n, r) => n + r.total, 0)
  return total > 0 ? (rows.reduce((n, r) => n + r.tw, 0) / total) * 20 : 0
}

export function watchList(state: PooleanState, limit = 3): WatchList {
  const byPlayer = new Map<string, { tw: number; total: number }[]>()
  for (const g of seasonGames(state).filter((x) => x.scoringEvents.length > 0)) {
    const [a, b] = scoreOf(g)
    for (const id of [...g.teamA, ...g.teamB]) {
      const tw = playerLine(g, id).twoWay
      if (tw === null) continue
      byPlayer.set(id, [...(byPlayer.get(id) ?? []), { tw, total: a + b }])
    }
  }
  const all: Watch[] = [...byPlayer.entries()]
    .filter(([, rows]) => rows.length >= MIN_GAMES)
    .map(([id, rows]) => {
      const half = Math.floor(rows.length / 2)
      const early = per20(rows.slice(0, half))
      const late = per20(rows.slice(half))
      return { id, games: rows.length, early, late, season: per20(rows), delta: late - early }
    })
  // Cooled off late but strong over the whole season: at or above the middle of the league's season rates.
  const sorted = all.map((w) => w.season).sort((x, y) => x - y)
  const median = sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : 0
  return {
    rising: all.filter((w) => w.delta >= MIN_SWING).sort((x, y) => y.delta - x.delta).slice(0, limit),
    bounce: all.filter((w) => w.delta <= -MIN_SWING && w.season >= median).sort((x, y) => x.delta - y.delta).slice(0, limit),
    rated: all.length,
  }
}
