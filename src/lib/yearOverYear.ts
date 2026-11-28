import { pointsAdded } from "@/lib/epa"
import { isFilmed } from "@/lib/filmed"
import { playerLine } from "@/lib/nightRecap"
import type { Game, PooleanState } from "@/lib/types"

// This season against last at the same point (Player page): a player's first n filmed games of this season beside their first n of the
// season before, n being as many as both have, so a fast start is never compared with a whole season's grind. Results (wins and losses)
// count every game, filmed or not, over the first as many games as both seasons have. Seasons come from startNewSeason (newSeason.ts):
// the current one starts at currentSeasonStartedAt, the last one at seasonHistory's latest startedAt (or the first game).

export interface YoyRow {
  key: string
  label: string
  now: number | null
  then: number | null
  higher: boolean // whether a higher number is better
  digits: number
  pct?: boolean
}

export interface YearOverYear {
  lastLabel: string
  filmed: number // filmed games compared from each season
  played: number // games compared for the record
  rows: YoyRow[]
  record: { now: [number, number]; then: [number, number] }
}

const winner = (g: Game) => (g.winner === "A" || g.winner === "B" ? g.winner : null)

export function yearOverYear(state: PooleanState, pid: string): YearOverYear | null {
  const start = state.currentSeasonStartedAt
  const last = (state.seasonHistory ?? []).at(-1)
  if (!start || !last) return null
  const mine = (g: Game) => !g.liveInProgress && !g.test && !!g.date && (g.teamA.includes(pid) || g.teamB.includes(pid))
  const byDate = (a: Game, b: Game) => (a.date || "").localeCompare(b.date || "")
  const now = state.games.filter((g) => mine(g) && g.date >= start).sort(byDate)
  const then = state.games.filter((g) => mine(g) && g.date < start && (!last.startedAt || g.date >= last.startedAt)).sort(byDate)
  if (!now.length || !then.length) return null

  const played = Math.min(now.length, then.length)
  const record = (games: Game[]): [number, number] => {
    let w = 0, l = 0
    for (const g of games.slice(0, played)) {
      const win = winner(g)
      if (!win) continue
      if ((win === "A") === g.teamA.includes(pid)) w++
      else l++
    }
    return [w, l]
  }

  const filmedNow = now.filter(isFilmed)
  const filmedThen = then.filter(isFilmed)
  const filmed = Math.min(filmedNow.length, filmedThen.length)
  const sums = (games: Game[]) => {
    const t = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, tpm: 0, fgm: 0, fga: 0, ftm: 0, two: 0, twoN: 0, pa: 0 }
    for (const g of games.slice(0, filmed)) {
      const l = playerLine(g, pid)
      t.pts += l.pts
      t.reb += l.reb
      t.ast += l.ast
      t.stl += l.stl
      t.blk += l.blk
      t.tov += l.tov
      t.tpm += l.tpm
      t.fgm += l.fgm
      t.fga += l.fga
      t.ftm += l.ftm
      if (l.twoWay !== null) (t.two += l.twoWay), t.twoN++
      t.pa += pointsAdded(state, { only: g.id }).rows.find((r) => r.id === pid)?.total ?? 0
    }
    return t
  }
  const a = sums(filmedNow)
  const b = sums(filmedThen)
  const per = (x: number) => (filmed ? x / filmed : null)
  const shooting = (t: typeof a) => (t.fga ? (t.fgm + 0.5 * t.tpm) / t.fga : null) // effective field goal share
  const rows: YoyRow[] = filmed
    ? [
        { key: "two", label: "Two-Way a game", now: a.twoN ? a.two / a.twoN : null, then: b.twoN ? b.two / b.twoN : null, higher: true, digits: 1 },
        { key: "pa", label: "Points added a game", now: per(a.pa), then: per(b.pa), higher: true, digits: 1 },
        { key: "pts", label: "Points a game", now: per(a.pts), then: per(b.pts), higher: true, digits: 1 },
        { key: "ast", label: "Assists a game", now: per(a.ast), then: per(b.ast), higher: true, digits: 1 },
        { key: "reb", label: "Rebounds a game", now: per(a.reb), then: per(b.reb), higher: true, digits: 1 },
        { key: "stocks", label: "Steals and blocks a game", now: per(a.stl + a.blk), then: per(b.stl + b.blk), higher: true, digits: 1 },
        { key: "tov", label: "Turnovers a game", now: per(a.tov), then: per(b.tov), higher: false, digits: 1 },
        { key: "efg", label: "Shooting (effective)", now: shooting(a), then: shooting(b), higher: true, digits: 0, pct: true },
      ]
    : []
  return { lastLabel: last.label, filmed, played, rows, record: { now: record(now), then: record(then) } }
}
