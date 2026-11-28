import { playValues, pointsAdded } from "@/lib/epa"
import type { Game, PooleanState } from "@/lib/types"
import { filmedGames } from "@/lib/filmed"

// Do players tire? Each filmed night's games in the order they were played, then how the league shot and looked after the ball by game
// number (first game of the night, second, third, fourth or later), and for each player their Points added a game early in the night
// (games 1 and 2) against later (3 and on). A player's gap leans toward no difference by LEAN games, so one late dud is not a verdict.

export const LEAN = 3
export const EARLY = 2 // games 1 to EARLY are "early"

// The order a night's games were played: by the live start time when there is one, else by recording part ("Aug 10 games pt 2" after
// "pt 1"; the recordings have no start time of their own) and where the game starts in it, else as stored.
export function nightOrder(state: PooleanState, date: string): Game[] {
  const part = (g: Game) => {
    const name = (state.masterVideos as { id: string; name?: string }[] | undefined)?.find((m) => m.id === g.masterVideoId)?.name ?? ""
    return Number(name.match(/pt\.?\s*(\d+)/i)?.[1] ?? 0)
  }
  const index = new Map(state.games.map((g, i) => [g.id, i]))
  return state.games
    .filter((g) => g.date === date && !g.liveInProgress && !g.test)
    .sort((a, b) => {
      if (a.startedAt && b.startedAt) return a.startedAt.localeCompare(b.startedAt)
      return part(a) - part(b) || (a.videoStart ?? 0) - (b.videoStart ?? 0) || index.get(a.id)! - index.get(b.id)!
    })
}

// Each filmed game's place in its night (1 for the first game).
export function gameNumbers(state: PooleanState): Map<string, number> {
  const out = new Map<string, number>()
  for (const date of new Set(state.games.map((g) => g.date))) nightOrder(state, date).forEach((g, i) => out.set(g.id, i + 1))
  return out
}

export interface Bucket {
  label: string // "Game 1", "Game 4+"
  games: number
  shots: number
  pps: number // points per shot (2s and 3s)
  fg: number // share of shots made
  turnovers: number // live-ball turnovers per 10 trips
}

export interface PlayerFatigue {
  id: string
  early: number // Points added a game, games 1 to EARLY
  late: number // games after EARLY
  earlyGames: number
  lateGames: number
  gap: number // late less early, leaned toward 0 by LEAN games
}

export interface Fatigue {
  buckets: Bucket[]
  // Points per shot, early games against late ones, and whether the gap is more than chance (twice its standard error).
  early: { shots: number; pps: number }
  late: { shots: number; pps: number }
  real: boolean
  players: PlayerFatigue[]
}

export function fatigue(state: PooleanState): Fatigue {
  const num = gameNumbers(state)
  const games = filmedGames(state)
  const plays = playValues(state, games.map((g) => g.id))
  const key = (n: number) => (n >= 4 ? 4 : n)
  const agg = new Map<number, { games: Set<string>; pts: number[]; tov: number; trips: number }>()
  const bucket = (n: number) => agg.get(key(n)) ?? agg.set(key(n), { games: new Set(), pts: [], tov: 0, trips: 0 }).get(key(n))!
  for (const p of plays) {
    const n = num.get(p.gameId)
    if (!n) continue
    const b = bucket(n)
    b.games.add(p.gameId)
    b.trips++
    if (p.kind === "turnover") b.tov++
    else b.pts.push(p.made ? p.points : 0)
  }
  const buckets: Bucket[] = [...agg]
    .sort((a, b) => a[0] - b[0])
    .map(([n, b]) => ({
      label: n >= 4 ? "Game 4+" : `Game ${n}`,
      games: b.games.size,
      shots: b.pts.length,
      pps: b.pts.length ? b.pts.reduce((a, x) => a + x, 0) / b.pts.length : 0,
      fg: b.pts.length ? b.pts.filter((x) => x > 0).length / b.pts.length : 0,
      turnovers: b.trips ? (b.tov / b.trips) * 10 : 0,
    }))
  // Early against late shooting, with a plain check on whether the gap beats chance.
  const split = (late: boolean) => plays.filter((p) => p.kind === "shot" && (num.get(p.gameId) ?? 0) > 0 && (num.get(p.gameId)! > EARLY) === late).map((p) => (p.made ? p.points : 0))
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0)
  const varOf = (xs: number[]) => (xs.length > 1 ? xs.reduce((a, x) => a + (x - mean(xs)) ** 2, 0) / (xs.length - 1) : 0)
  const e = split(false)
  const l = split(true)
  const se = Math.sqrt((e.length ? varOf(e) / e.length : 0) + (l.length ? varOf(l) / l.length : 0))
  const real = e.length >= 20 && l.length >= 20 && se > 0 && Math.abs(mean(l) - mean(e)) > 2 * se

  // Each player's Points added a game, early in the night against late.
  const lines = new Map<string, { early: number[]; late: number[] }>()
  for (const g of games) {
    const n = num.get(g.id)
    if (!n) continue
    for (const r of pointsAdded(state, { only: g.id }).rows) {
      const v = lines.get(r.id) ?? lines.set(r.id, { early: [], late: [] }).get(r.id)!
      ;(n > EARLY ? v.late : v.early).push(r.total)
    }
  }
  const players: PlayerFatigue[] = []
  for (const [id, v] of lines) {
    if (!v.early.length || !v.late.length) continue
    const raw = mean(v.late) - mean(v.early)
    const n = 2 / (1 / v.early.length + 1 / v.late.length) // the two sides' games, as one count
    players.push({ id, early: mean(v.early), late: mean(v.late), earlyGames: v.early.length, lateGames: v.late.length, gap: (raw * n) / (n + LEAN) })
  }
  players.sort((a, b) => b.gap - a.gap)
  return { buckets, early: { shots: e.length, pps: mean(e) }, late: { shots: l.length, pps: mean(l) }, real, players }
}
