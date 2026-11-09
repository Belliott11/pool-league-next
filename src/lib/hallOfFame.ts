import data from "@/data/poolean-seasons.json"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import { realSeasonsInOrder, type RealGame } from "@/lib/real"
import { gameKey } from "@/lib/winImpact"
import type { Game, PooleanState } from "@/lib/types"

// All-time marks across every game in the app, plus the voted MVPs of the imported past seasons.
export interface Career {
  id: string
  gp: number
  w: number
  pts: number
  twoWay: number
}

const finished = (state: PooleanState): Game[] =>
  state.games
    .filter((g) => !g.liveInProgress && g.date)
    .filter((g) => {
      const [a, b] = scoreOf(g)
      return a + b > 0
    })
    .sort((a, b) => a.date.localeCompare(b.date))

export function careers(state: PooleanState): Career[] {
  const m = new Map<string, Career>()
  for (const g of finished(state)) {
    const [a, b] = scoreOf(g)
    for (const p of [...g.teamA, ...g.teamB]) {
      const c = m.get(p) ?? { id: p, gp: 0, w: 0, pts: 0, twoWay: 0 }
      const line = playerLine(g, p)
      c.gp++
      if ((g.teamA.includes(p) && a > b) || (g.teamB.includes(p) && b > a)) c.w++
      c.pts += line.pts
      c.twoWay += line.twoWay ?? 0
      m.set(p, c)
    }
  }
  return [...m.values()]
}

// Everyone's career line, most games first (wins break ties). Sorting by games needs no minimum, so it is never empty.
export function careerTable(state: PooleanState, n = 10): Career[] {
  return careers(state)
    .sort((x, y) => y.gp - x.gp || y.w - x.w)
    .slice(0, n)
}

export interface BestGame {
  id: string
  gameId: string
  date: string
  value: number
}

// The best single games ever by points or by two-way score (two-way needs a box score).
export function bestGames(state: PooleanState, key: "pts" | "twoWay", n = 5): BestGame[] {
  const out: BestGame[] = []
  for (const g of finished(state)) {
    for (const p of [...g.teamA, ...g.teamB]) {
      const line = playerLine(g, p)
      const v = key === "pts" ? line.pts : line.twoWay
      if (v !== null && v > 0) out.push({ id: p, gameId: g.id, date: g.date, value: Math.round(v * 10) / 10 })
    }
  }
  return out.sort((a, b) => b.value - a.value || a.date.localeCompare(b.date)).slice(0, n)
}

// Each player's longest run of wins, best first.
export function longestStreaks(state: PooleanState, n = 5, old: RealGame[] = realSeasonsInOrder().flatMap((s) => s.games)): { id: string; n: number; end: string }[] {
  const run = new Map<string, number>()
  const best = new Map<string, { n: number; end: string }>()
  // Every old-site result, then app games the old site does not have, in date order. A game on both counts once.
  const seen = new Set(old.map((g) => gameKey(g.date, g.a, g.b)))
  const played = [
    ...[...old].sort((x, y) => x.date.localeCompare(y.date) || x.n - y.n).map((g) => ({ date: g.date, won: g.w === "A" ? g.a : g.b, lost: g.w === "A" ? g.b : g.a })),
    ...finished(state).flatMap((g) => {
      const [a, b] = scoreOf(g)
      return a === b || seen.has(gameKey(g.date, g.teamA, g.teamB)) ? [] : [{ date: g.date, won: a > b ? g.teamA : g.teamB, lost: a > b ? g.teamB : g.teamA }]
    }),
  ].sort((x, y) => x.date.localeCompare(y.date))
  for (const g of played) {
    for (const p of g.lost) run.set(p, 0)
    for (const p of g.won) {
      const cur = (run.get(p) ?? 0) + 1
      run.set(p, cur)
      if (cur > (best.get(p)?.n ?? 0)) best.set(p, { n: cur, end: g.date })
    }
  }
  return [...best.entries()].map(([id, v]) => ({ id, ...v })).filter((s) => s.n >= 2).sort((x, y) => y.n - x.n).slice(0, n)
}

export interface MvpWinner {
  season: string
  ids: string[] // more than one when the vote tied
}

// Each past season's voted MVP, from the imported seasons' own awards. Newest first.
export function pastMvps(): MvpWinner[] {
  const list = data.list as string[]
  const seasons = data.seasons as unknown as Record<string, { awards?: { key: string; winners: string[] }[] }>
  return list
    .map((year) => {
      const winners = seasons[year]?.awards?.find((a) => a.key === "mvp")?.winners ?? []
      return winners.length ? { season: year, ids: winners } : null
    })
    .filter((m): m is MvpWinner => !!m)
    .reverse()
}
