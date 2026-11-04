import data from "@/data/poolean-seasons.json"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import type { RealSeason } from "@/lib/real"
import type { Game, PooleanState } from "@/lib/types"

// All-time marks across every game in the app, plus the champions of the imported past seasons.
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
export function longestStreaks(state: PooleanState, n = 5): { id: string; n: number; end: string }[] {
  const run = new Map<string, number>()
  const best = new Map<string, { n: number; end: string }>()
  for (const g of finished(state)) {
    const [a, b] = scoreOf(g)
    if (a === b) continue
    for (const p of [...g.teamA, ...g.teamB]) {
      const won = g.teamA.includes(p) ? a > b : b > a
      const cur = won ? (run.get(p) ?? 0) + 1 : 0
      run.set(p, cur)
      if (cur > (best.get(p)?.n ?? 0)) best.set(p, { n: cur, end: g.date })
    }
  }
  return [...best.entries()].map(([id, v]) => ({ id, ...v })).filter((s) => s.n >= 2).sort((x, y) => y.n - x.n).slice(0, n)
}

export interface Champion {
  season: string
  name: string
  id: string
  how: string
}

// Past seasons' champions: the best power percentage among players who came to at least half the nights.
export function pastChampions(): Champion[] {
  const list = data.list as string[]
  const seasons = data.seasons as unknown as Record<string, RealSeason & { cards: Record<string, { powerPct: number; parties: number }> }>
  return list
    .map((year) => {
      const s = seasons[year]
      if (!s) return null
      const cards = Object.entries(s.cards)
      const most = Math.max(0, ...cards.map(([, c]) => c.parties))
      const top = cards.filter(([, c]) => c.parties >= most / 2).sort((x, y) => y[1].powerPct - x[1].powerPct)[0]
      return top ? { season: year, id: top[0], name: s.names[top[0]] ?? top[0], how: `${Math.round(top[1].powerPct)}% power` } : null
    })
    .filter((c): c is Champion => !!c)
    .reverse()
}
