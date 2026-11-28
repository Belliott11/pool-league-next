import { pointsAdded } from "@/lib/epa"
import { headToHead, pairRecord } from "@/lib/headToHead"
import { winProbAdded } from "@/lib/insight"
import { playerLine, type PlayerLine } from "@/lib/nightRecap"
import { defenseTable, playerDefense } from "@/lib/playerDefense"
import { realSeasonsInOrder } from "@/lib/real"
import { computeLeaderboard } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"
import { signed } from "@/lib/format"

// "Settle it": two players side by side for an argument. Every row is a stat the site already works out, with a minimum sample before
// it counts, and the verdict is simply how many rows each one wins. Nothing here is new math.

export const MIN_GAMES = 3 // filmed games before a filmed stat counts
export const MIN_TRIPS = 10 // trips used before Points added counts
export const MIN_GUARDED = 5 // shots guarded before defense counts

export interface TapeRow {
  label: string
  a: number | null
  b: number | null
  text: (v: number) => string
  higher: boolean // true when a bigger number is better
  note: string // where it comes from
}

export interface Tape {
  rows: TapeRow[]
  aWins: number
  bWins: number
}

// A player's record over every result on record (the old site's full list, filmed or not).
export function allTimeRecord(id: string): [number, number] {
  let w = 0
  let l = 0
  for (const s of realSeasonsInOrder())
    for (const g of s.games) {
      const onA = g.a.includes(id)
      const onB = g.b.includes(id)
      if (!onA && !onB) continue
      if ((onA && g.w === "A") || (onB && g.w === "B")) w++
      else l++
    }
  return [w, l]
}

const pct = (v: number) => `${Math.round(v * 100)}%`
const one = (v: number) => v.toFixed(1)

export function taleOfTheTape(state: PooleanState, a: string, b: string): Tape {
  const board = computeLeaderboard(state)
  const row = (id: string) => board.find((r) => r.player.id === id)
  const filmed = (id: string, f: (r: NonNullable<ReturnType<typeof row>>) => number | null) => {
    const r = row(id)
    return r && r.gp >= MIN_GAMES ? f(r) : null
  }
  const epa = pointsAdded(state).rows
  const pa = (id: string) => {
    const r = epa.find((x) => x.id === id)
    return r && r.used >= MIN_TRIPS ? r.perGame : null
  }
  const wpa = winProbAdded(state).rows
  const wc = (id: string) => {
    const r = wpa.find((x) => x.id === id)
    return r && r.games >= MIN_GAMES ? r.net25 * 100 : null
  }
  const dt = defenseTable(state)
  const def = (id: string) => {
    const d = playerDefense(dt, id).me
    return d && d.shots >= MIN_GUARDED ? d.saved10 : null
  }
  const rec = (id: string) => {
    const [w, l] = allTimeRecord(id)
    return w + l >= MIN_GAMES ? w / (w + l) : null
  }
  const vs = pairRecord(a, b).vs
  const met = vs[0] + vs[1] > 0
  const rows: TapeRow[] = [
    { label: "Against each other", a: met ? vs[0] : null, b: met ? vs[1] : null, text: (v) => String(v), higher: true, note: "Wins when on opposite teams, every result on record" },
    { label: "Win rate, all time", a: rec(a), b: rec(b), text: pct, higher: true, note: "Every result on record, filmed or not" },
    { label: "Two-Way a game", a: filmed(a, (r) => r.twoWayPer25), b: filmed(b, (r) => r.twoWayPer25), text: one, higher: true, note: "Offense plus defense, filmed games" },
    { label: "Points added a game", a: pa(a), b: pa(b), text: signed, higher: true, note: "Every play against an average trip" },
    { label: "Win chance added a game", a: wc(a), b: wc(b), text: signed, higher: true, note: "How far their plays moved the live odds" },
    { label: "Points a game", a: filmed(a, (r) => r.ptsPer25), b: filmed(b, (r) => r.ptsPer25), text: one, higher: true, note: "Filmed games, scaled to an average game" },
    { label: "Assists a game", a: filmed(a, (r) => r.astPer25), b: filmed(b, (r) => r.astPer25), text: one, higher: true, note: "Filmed games, scaled to an average game" },
    { label: "True shooting", a: filmed(a, (r) => (r.tsPct === null ? null : r.tsPct / 100)), b: filmed(b, (r) => (r.tsPct === null ? null : r.tsPct / 100)), text: pct, higher: true, note: "Points per shot, free throws included" },
    { label: "Defense", a: def(a), b: def(b), text: signed, higher: true, note: "Points saved per 10 shots guarded, against what those shooters usually score" },
    { label: "Live-ball turnovers a game", a: filmed(a, (r) => r.liveTovPer25), b: filmed(b, (r) => r.liveTovPer25), text: one, higher: false, note: "Fewer is better" },
  ]
  let aWins = 0
  let bWins = 0
  for (const r of rows) {
    if (r.a === null || r.b === null || Math.abs(r.a - r.b) < 1e-6) continue
    if (r.a > r.b === r.higher) aWins++
    else bWins++
  }
  return { rows, aWins, bWins }
}

export interface BestGame {
  id: string
  game: Game
  line: PlayerLine
  won: boolean
}

// Each player's best games against the other (filmed meetings, by Two-Way; points when a game has no box score), up to two each.
export function bestAgainst(state: PooleanState, a: string, b: string, n = 2): BestGame[] {
  const h = headToHead(state, a, b)
  const pick = (id: string) =>
    h.meetings
      .map((m) => {
        const line = playerLine(m.game, id)
        const mine = id === a ? m.aScore : m.bScore
        const theirs = id === a ? m.bScore : m.aScore
        return { id, game: m.game, line, won: mine > theirs }
      })
      .filter((x) => x.line.pts > 0 || (x.line.twoWay ?? 0) > 0)
      .sort((x, y) => (y.line.twoWay ?? y.line.pts / 2) - (x.line.twoWay ?? x.line.pts / 2))
      .slice(0, n)
  return [...pick(a), ...pick(b)]
}
