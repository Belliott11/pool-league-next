import { playerLine, scoreOf } from "@/lib/nightRecap"
import { computeLeaderboard, isCurrentSeasonGame } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// Who leads each award so far this season, from this app's own games (the games since the season started). The
// imported seasons have their own award race; this one is for the season being played now.
export interface Leader {
  ids: string[]
  value: string
}
export interface RaceRow {
  key: string
  label: string
  basis: string
  leaders: Leader[]
}

const MIN_GAMES = 3

export function awardRace(state: PooleanState): RaceRow[] {
  const games = state.games.filter((g) => !g.liveInProgress && g.date && isCurrentSeasonGame(state, g)).sort((a, b) => a.date.localeCompare(b.date))
  if (games.length === 0) return []
  const season = { ...state, games }
  const rows: RaceRow[] = []
  const top = (xs: { ids: string[]; value: string }[]) => xs.slice(0, 3)
  const board = computeLeaderboard(season).filter((r) => r.gp >= Math.min(MIN_GAMES, 2))
  const nameOf = (id: string) => id

  // Most wins, counting every finished game (live-scored ones too), not only box-scored ones.
  const record = new Map<string, { w: number; l: number }>()
  for (const g of games) {
    const [a, b] = scoreOf(g)
    if (a === b) continue
    for (const id of [...g.teamA, ...g.teamB]) {
      const r = record.get(id) ?? { w: 0, l: 0 }
      if ((a > b) === g.teamA.includes(id)) r.w++
      else r.l++
      record.set(id, r)
    }
  }
  const byWins = [...record.entries()].sort((x, y) => y[1].w - x[1].w || x[1].l - y[1].l)
  if (byWins.length) rows.push({ key: "mvp", label: "MVP race", basis: "Most wins", leaders: top(byWins.map(([id, r]) => ({ ids: [id], value: `${r.w}-${r.l}` }))) })

  // Best all-around: two-way per 20, the same number as the standings.
  const byTwoWay = board.filter((r) => r.gp >= MIN_GAMES).sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
  if (byTwoWay.length) rows.push({ key: "best-player", label: "Best player", basis: "Two-way per 20", leaders: top(byTwoWay.map((r) => ({ ids: [r.player.id], value: `${r.twoWayPer20.toFixed(1)} per 20` }))) })

  // Defender: the defensive part of two-way (two-way minus offense), per 20.
  const byDefense = board.filter((r) => r.gp >= MIN_GAMES).map((r) => ({ r, d: r.twoWayPer20 - r.offRatingPer20 })).sort((a, b) => b.d - a.d)
  if (byDefense.length) rows.push({ key: "dpoy", label: "Defender", basis: "Defense rating per 20", leaders: top(byDefense.map((x) => ({ ids: [x.r.player.id], value: `${x.d.toFixed(1)} per 20` }))) })

  // Clutch: win rate in games decided by 3 or fewer, at least 2 of them.
  const close = new Map<string, { w: number; gp: number }>()
  for (const g of games) {
    const [a, b] = scoreOf(g)
    if (a === b || Math.abs(a - b) > 3) continue
    const winners = a > b ? g.teamA : g.teamB
    for (const id of [...g.teamA, ...g.teamB]) {
      const c = close.get(id) ?? { w: 0, gp: 0 }
      c.gp++
      if (winners.includes(id)) c.w++
      close.set(id, c)
    }
  }
  const clutch = [...close.entries()].filter(([, c]) => c.gp >= 2).sort((x, y) => (y[1].w + 1) / (y[1].gp + 2) - (x[1].w + 1) / (x[1].gp + 2) || y[1].gp - x[1].gp)
  if (clutch.length) rows.push({ key: "clutch", label: "Clutch", basis: "Record in games decided by 3 or fewer", leaders: top(clutch.map(([id, c]) => ({ ids: [id], value: `${c.w}-${c.gp - c.w} in close games` }))) })

  // Most improved: two-way per game in a player's later games against their earlier ones, at least 4 box-scored games.
  const lines = new Map<string, number[]>()
  for (const g of games) for (const id of [...g.teamA, ...g.teamB]) {
    const l = playerLine(g, id)
    if (l.twoWay !== null) lines.set(id, [...(lines.get(id) ?? []), l.twoWay])
  }
  const improved = [...lines.entries()]
    .filter(([, v]) => v.length >= 4)
    .map(([id, v]) => {
      const h = Math.floor(v.length / 2)
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      return { id, delta: avg(v.slice(h)) - avg(v.slice(0, h)) }
    })
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
  if (improved.length) rows.push({ key: "mip", label: "Most improved", basis: "Later games against earlier ones, two-way per game", leaders: top(improved.map((x) => ({ ids: [x.id], value: `up ${x.delta.toFixed(1)} a game` }))) })

  // Duos: record together, pulled toward even by 5 phantom games so 9-1 beats 3-0.
  const duos = new Map<string, { w: number; gp: number; ids: string[] }>()
  const together = (g: Game, team: string[], won: boolean) => {
    for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) {
      const ids = [team[i], team[j]].sort()
      const k = ids.join("|")
      const d = duos.get(k) ?? { w: 0, gp: 0, ids }
      d.gp++
      if (won) d.w++
      duos.set(k, d)
    }
    void g
  }
  for (const g of games) {
    const [a, b] = scoreOf(g)
    if (a === b) continue
    together(g, g.teamA, a > b)
    together(g, g.teamB, b > a)
  }
  const pairs = [...duos.values()].filter((d) => d.gp >= MIN_GAMES).map((d) => ({ ...d, rate: (d.w + 2.5) / (d.gp + 5) }))
  const fmt = (d: (typeof pairs)[number]): Leader => ({ ids: d.ids, value: `${d.w}-${d.gp - d.w} together` })
  if (pairs.length) {
    rows.push({ key: "best-duo", label: "Best duo", basis: `Record together, ${MIN_GAMES}+ games`, leaders: top([...pairs].sort((a, b) => b.rate - a.rate || b.gp - a.gp).map(fmt)) })
    rows.push({ key: "worst-duo", label: "Worst duo", basis: `Record together, ${MIN_GAMES}+ games`, leaders: top([...pairs].sort((a, b) => a.rate - b.rate || b.gp - a.gp).map(fmt)) })
  }
  void nameOf
  return rows
}
