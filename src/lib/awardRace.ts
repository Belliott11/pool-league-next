import { sizeAllowed } from "@/lib/filters"
import { distinctNumbers, signed } from "@/lib/format"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import { computeLeaderboard, defensiveRating, gameDefenseStats, getGameStats, isCurrentSeasonGame } from "@/lib/stats"
import { teammateFit } from "@/lib/teammates"
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
  field: number // how many eligible players (or duos) are in this race
}

// A race with fewer than this many in it is not shown: two people is a head-to-head, not an award. (It still counts for predictions.)
export const MIN_FIELD = 3
export const shownAwards = (rows: RaceRow[]) => rows.filter((r) => r.field >= MIN_FIELD)

const MIN_GAMES = 3 // games a duo needs together
// Nobody is in an award race until they have played MIN_RANKED games (the same bar as ratings and the standings), so a newcomer's first
// good night is not a headline about them.

export function awardRace(state: PooleanState): RaceRow[] {
  const games = state.games.filter((g) => !g.liveInProgress && g.date && isCurrentSeasonGame(state, g) && sizeAllowed(g)).sort((a, b) => a.date.localeCompare(b.date))
  if (games.length === 0) return []
  const season = { ...state, games }
  const rows: RaceRow[] = []
  const top = (xs: { ids: string[]; value: string }[]) => xs.slice(0, 3)
  const board = computeLeaderboard(season)
  const played = new Map<string, number>()
  for (const g of games) for (const id of [...g.teamA, ...g.teamB]) played.set(id, (played.get(id) ?? 0) + 1)
  const eligible = (id: string) => (played.get(id) ?? 0) >= MIN_RANKED
  const nameOf = (id: string) => id

  // MVP is total two-way score over the season, and the defender award is total defensive score: both need a box
  // score, and both add up every game, so playing more games counts.
  const totals = new Map<string, { twoWay: number; defense: number; gp: number }>()
  for (const g of games) {
    if (g.scoringEvents.length === 0) continue
    for (const id of [...g.teamA, ...g.teamB]) {
      const l = playerLine(g, id)
      if (l.twoWay === null) continue
      const t = totals.get(id) ?? { twoWay: 0, defense: 0, gp: 0 }
      t.twoWay += l.twoWay
      t.defense += defensiveRating(getGameStats(g, id), gameDefenseStats(g, id))
      t.gp++
      totals.set(id, t)
    }
  }
  const boxed = [...totals.entries()].filter(([id, t]) => t.gp >= 2 && eligible(id))
  const byTotal = [...boxed].sort((x, y) => y[1].twoWay - x[1].twoWay)
  if (byTotal.length) rows.push({ key: "mvp", label: "MVP race", basis: "Total two-way score", field: byTotal.length, leaders: top(byTotal.map(([id, t]) => ({ ids: [id], value: `${t.twoWay.toFixed(1)} over ${t.gp} games` }))) })

  // Best all-around: two-way per game, the same number as the standings.
  const byTwoWay = board.filter((r) => eligible(r.player.id)).sort((a, b) => b.twoWayPer25 - a.twoWayPer25)
  if (byTwoWay.length) {
    const text = distinctNumbers(byTwoWay.map((r) => r.twoWayPer25))
    rows.push({ key: "best-player", label: "Best player", basis: "Two-way per game", field: byTwoWay.length, leaders: top(byTwoWay.map((r, i) => ({ ids: [r.player.id], value: `${text[i]} per game` }))) })
  }

  // First and second team: the six best by two-way per game, places 1 to 3 the first team and 4 to 6 the second, like the vote.
  if (byTwoWay.length >= 4) {
    const text = distinctNumbers(byTwoWay.map((r) => r.twoWayPer25))
    rows.push({ key: "teams", label: "First and second team", basis: "Two-way per game, places 1 to 3 and 4 to 6", field: byTwoWay.length, leaders: byTwoWay.slice(0, 6).map((r, i) => ({ ids: [r.player.id], value: `${i < 3 ? "first" : "second"} team, ${text[i]}` })) })
  }

  // Defender: total defensive score.
  const byDefense = [...boxed].sort((x, y) => y[1].defense - x[1].defense)
  if (byDefense.length) rows.push({ key: "dpoy", label: "Defender", basis: "Total defensive score", field: byDefense.length, leaders: top(byDefense.map(([id, t]) => ({ ids: [id], value: `${t.defense.toFixed(1)} over ${t.gp} games` }))) })

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
  const clutch = [...close.entries()].filter(([id, c]) => c.gp >= 2 && eligible(id)).sort((x, y) => (y[1].w + 1) / (y[1].gp + 2) - (x[1].w + 1) / (x[1].gp + 2) || y[1].gp - x[1].gp)
  if (clutch.length) rows.push({ key: "clutch", label: "Clutch", basis: "Record in games decided by 3 or fewer", field: clutch.length, leaders: top(clutch.map(([id, c]) => ({ ids: [id], value: `${c.w}-${c.gp - c.w} in close games` }))) })

  // Most improved: two-way per game in a player's later games against their earlier ones, at least 4 box-scored games.
  const lines = new Map<string, number[]>()
  for (const g of games) for (const id of [...g.teamA, ...g.teamB]) {
    const l = playerLine(g, id)
    if (l.twoWay !== null) lines.set(id, [...(lines.get(id) ?? []), l.twoWay])
  }
  const improvers = [...lines.entries()].filter(([id, v]) => v.length >= 4 && eligible(id))
  const improved = improvers
    .map(([id, v]) => {
      const h = Math.floor(v.length / 2)
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
      return { id, delta: avg(v.slice(h)) - avg(v.slice(0, h)) }
    })
    .filter((x) => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
  if (improved.length) rows.push({ key: "mip", label: "Most improved", basis: "Later games against earlier ones, two-way per game", field: improvers.length, leaders: top(improved.map((x) => ({ ids: [x.id], value: `up ${x.delta.toFixed(1)} a game` }))) })

  // Most improved since last season: two-way per game this season against the season before (seasonHistory), 3+ box scores in each.
  const prev = (state.seasonHistory ?? []).at(-1)
  if (state.currentSeasonStartedAt && prev) {
    const before = state.games.filter((g) => !g.liveInProgress && g.date && g.date < state.currentSeasonStartedAt! && (!prev.startedAt || g.date >= prev.startedAt) && sizeAllowed(g))
    const avgOf = (gs: Game[], id: string) => {
      const v = gs.filter((g) => g.scoringEvents.length > 0 && (g.teamA.includes(id) || g.teamB.includes(id))).map((g) => playerLine(g, id).twoWay).filter((x): x is number => x !== null)
      return v.length >= 3 ? v.reduce((a, x) => a + x, 0) / v.length : null
    }
    const yoy = [...played.keys()]
      .filter(eligible)
      .map((id) => ({ id, now: avgOf(games, id), then: avgOf(before, id) }))
      .filter((x): x is { id: string; now: number; then: number } => x.now !== null && x.then !== null)
    const up = yoy.map((x) => ({ id: x.id, delta: x.now - x.then })).filter((x) => x.delta > 0).sort((a, b) => b.delta - a.delta)
    if (up.length) rows.push({ key: "mip-yoy", label: "Most improved since last season", basis: `Two-way per game against ${prev.label}`, field: yoy.length, leaders: top(up.map((x) => ({ ids: [x.id], value: `up ${x.delta.toFixed(1)} a game` }))) })
  }

  // Teammate: how much better their teammates play with them on the team than without (Points added a game, leaned for small samples;
  // teammates.ts), averaged over the teammates it can be measured for, at least 2 of them.
  const lifts = [...played.keys()]
    .filter(eligible)
    .map((id) => {
      const mates = new Set(games.flatMap((g) => (g.teamA.includes(id) ? g.teamA : g.teamB.includes(id) ? g.teamB : [])).filter((m) => m !== id))
      const v = [...mates].map((m) => teammateFit(season, m).find((f) => f.id === id)?.lift).filter((x): x is number => x !== null && x !== undefined)
      return { id, lift: v.length >= 2 ? v.reduce((a, x) => a + x, 0) / v.length : null, n: v.length }
    })
    .filter((x): x is { id: string; lift: number; n: number } => x.lift !== null)
    .sort((a, b) => b.lift - a.lift)
  if (lifts.length) rows.push({ key: "teammate", label: "Teammate", basis: "How much better teammates play with them than without, Points added a game", field: lifts.length, leaders: top(lifts.map((x) => ({ ids: [x.id], value: `${signed(x.lift)} for ${x.n} teammates` }))) })

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
  const pairs = [...duos.values()].filter((d) => d.gp >= MIN_GAMES && d.ids.every(eligible)).map((d) => ({ ...d, rate: (d.w + 2.5) / (d.gp + 5) }))
  const fmt = (d: (typeof pairs)[number]): Leader => ({ ids: d.ids, value: `${d.w}-${d.gp - d.w} together` })
  if (pairs.length) {
    rows.push({ key: "best-duo", label: "Best duo", basis: `Record together, ${MIN_GAMES}+ games, both with ${MIN_RANKED}+`, field: pairs.length, leaders: top([...pairs].sort((a, b) => b.rate - a.rate || b.gp - a.gp).map(fmt)) })
    rows.push({ key: "worst-duo", label: "Worst duo", basis: `Record together, ${MIN_GAMES}+ games, both with ${MIN_RANKED}+`, field: pairs.length, leaders: top([...pairs].sort((a, b) => a.rate - b.rate || b.gp - a.gp).map(fmt)) })
  }
  void nameOf
  return rows
}
