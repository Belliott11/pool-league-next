import { PER } from "@/lib/per"
import { getGameStats } from "@/lib/stats"
import type { Game, PooleanState, ScoringEvent, TurnoverEvent } from "@/lib/types"

// Four views of why games go the way they do, each from the shots, turnovers and box scores already logged. Nothing is
// stored. They count every finished game with a shot log (live games and games stopped early are left out) and two
// teams that scored differently.
const made = (e: ScoringEvent) => e.made !== false
const pts = (e: ScoringEvent) => (made(e) ? e.points : 0)
const side = (g: Game, id: string): 0 | 1 | null => (g.teamA.includes(id) ? 0 : g.teamB.includes(id) ? 1 : null)
const members = (g: Game) => [...g.teamA, ...g.teamB]
// A stolen or blocked shot is logged as a miss and a turnover. It is already a shot, so only these end a possession without one.
const liveTurnovers = (g: Game) => {
  const shotBased = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
  return g.turnoverEvents.filter((x) => !shotBased.has(x.id))
}

function usable(g: Game): boolean {
  if (g.liveInProgress || g.stoppedEarly || g.scoringEvents.length === 0 || g.teamA.length === 0 || g.teamB.length === 0) return false
  const s = score(g)
  return s[0] !== s[1]
}
function score(g: Game): [number, number] {
  const s: [number, number] = [0, 0]
  for (const e of g.scoringEvents) {
    const t = side(g, e.scorerId)
    if (t !== null) s[t] += pts(e)
  }
  return s
}
export const games = (state: PooleanState) => state.games.filter(usable)
const total = (g: Game) => score(g)[0] + score(g)[1]

// League points per shot for each kind of shot (type and how closely it was guarded), the yardstick for shot quality.
export function yardstick(gs: Game[]) {
  const by = new Map<string, [number, number]>()
  const key = (e: ScoringEvent) => `${e.shotType ?? "?"}|${e.contestLevel ?? "?"}`
  let sum = 0
  let n = 0
  for (const g of gs)
    for (const e of g.scoringEvents) {
      const a = by.get(key(e)) ?? [0, 0]
      by.set(key(e), [a[0] + pts(e), a[1] + 1])
      sum += pts(e)
      n++
    }
  const all = n ? sum / n : 0
  return (e: ScoringEvent) => {
    const a = by.get(key(e))
    return a && a[1] >= 5 ? a[0] / a[1] : all
  }
}

// 1. What decided each game ---------------------------------------------------------------------------------------
// The margin is split exactly (the five parts always add back to it) into: how good the shots were, how many went in
// beyond what that quality says, giveaways, offensive rebounds, and everything else (a different number of plays that
// none of those explain).
export const FACTORS = ["quality", "making", "turnovers", "rebounds", "other"] as const
export type Factor = (typeof FACTORS)[number]
export const FACTOR_LABEL: Record<Factor, string> = { quality: "Shot quality", making: "Shot making", turnovers: "Turnovers", rebounds: "Offensive rebounds", other: "Everything else" }
export const FACTOR_HINT: Record<Factor, string> = {
  quality: "How good the shots were: type and how closely they were guarded, against the league's average for that shot.",
  making: "Points from shots going in more or less often than their quality says.",
  turnovers: "Points from giving the ball away less often, counted at the league's points per shot.",
  rebounds: "Points from more second chances, counted the same way.",
  other: "A different number of shots that turnovers and rebounds do not explain, such as pace or plays that were not logged.",
}

export interface Breakdown {
  games: number
  margin: number // average size of the margin, always positive
  edge: Record<Factor, number> // average points toward the side being described
  favored: Record<Factor, number> // games where that factor went that side's way
}

export type Parts = Record<Factor, number>

// One game from team A's side, or null when a team took no shots.
export function partsOf(g: Game, expect: (e: ScoringEvent) => number): { margin: number; parts: Parts } | null {
  const t = [0, 1].map((i) => ({ shots: 0, pts: 0, xpts: 0, tov: 0, oreb: 0, ids: i === 0 ? g.teamA : g.teamB }))
  for (const e of g.scoringEvents) {
    const i = side(g, e.scorerId)
    if (i === null) continue
    t[i].shots++
    t[i].pts += pts(e)
    t[i].xpts += expect(e)
  }
  for (const x of liveTurnovers(g)) {
    const i = side(g, x.playerId)
    if (i !== null) t[i].tov++
  }
  for (const i of [0, 1]) for (const id of t[i].ids) t[i].oreb += getGameStats(g, id).oreb
  const [a, b] = t
  if (a.shots === 0 || b.shots === 0) return null
  const x = a.pts / a.shots
  const y = b.pts / b.shots
  const ex = a.xpts / a.shots
  const ey = b.xpts / b.shots
  const avgShots = (a.shots + b.shots) / 2
  const avgPps = (x + y) / 2
  const margin = a.pts - b.pts
  const quality = avgShots * (ex - ey)
  const making = avgShots * (x - ex - (y - ey))
  const turnovers = -(a.tov - b.tov) * avgPps
  const rebounds = (a.oreb - b.oreb) * avgPps
  return { margin, parts: { quality, making, turnovers, rebounds, other: margin - quality - making - turnovers - rebounds } }
}

// With `only`, one player's games from their own team's side. Without, every game from the winner's side.
export function marginBreakdown(state: PooleanState, only?: string): Breakdown {
  const gs = games(state)
  const expect = yardstick(gs)
  const out: Breakdown = { games: 0, margin: 0, edge: { quality: 0, making: 0, turnovers: 0, rebounds: 0, other: 0 }, favored: { quality: 0, making: 0, turnovers: 0, rebounds: 0, other: 0 } }
  for (const g of gs) {
    if (only && side(g, only) === null) continue
    const p = partsOf(g, expect)
    if (!p) continue
    const view = only ? (side(g, only) === 0 ? 1 : -1) : p.margin > 0 ? 1 : -1
    out.games++
    out.margin += Math.abs(p.margin)
    for (const f of FACTORS) {
      const v = p.parts[f] * view
      out.edge[f] += v
      if (v > 0) out.favored[f]++
    }
  }
  if (out.games > 0) {
    out.margin /= out.games
    for (const f of FACTORS) out.edge[f] /= out.games
  }
  return out
}

// 2. Shots created ------------------------------------------------------------------------------------------------
export interface Creator {
  id: string
  games: number
  created: number // shots the player passed to a teammate, made or missed
  made: number // of those, how many went in
  assists: number // credited assists
  expected: number // average quality of the shots they set up, in points per shot
  created25: number
  assists25: number
}
export interface Creation {
  rows: Creator[]
  league: { passed: number; passedFg: number | null; otherFg: number | null }
}

const validPass = (g: Game, e: ScoringEvent): string | null => {
  const p = e.passerId
  if (!p || p === "none" || p === e.scorerId) return null
  const a = side(g, p)
  return a !== null && a === side(g, e.scorerId) ? p : null
}

export function shotsCreated(state: PooleanState): Creation {
  const gs = games(state)
  const expect = yardstick(gs)
  const by = new Map<string, { games: number; created: number; made: number; assists: number; xp: number; points: number }>()
  const row = (id: string) => by.get(id) ?? by.set(id, { games: 0, created: 0, made: 0, assists: 0, xp: 0, points: 0 }).get(id)!
  let passed = 0
  let passedMade = 0
  let other = 0
  let otherMade = 0
  for (const g of gs) {
    for (const id of members(g)) {
      const r = row(id)
      r.games++
      r.points += total(g)
    }
    for (const e of g.scoringEvents) {
      const p = validPass(g, e)
      if (p) {
        const r = row(p)
        r.created++
        r.xp += expect(e)
        if (made(e)) r.made++
        passed++
        if (made(e)) passedMade++
      } else {
        other++
        if (made(e)) otherMade++
      }
      if (made(e) && e.assistId && side(g, e.assistId) !== null) row(e.assistId).assists++
    }
  }
  const rows = [...by]
    .filter(([, r]) => r.created > 0 || r.assists > 0)
    .map(([id, r]) => ({
      id,
      games: r.games,
      created: r.created,
      made: r.made,
      assists: r.assists,
      expected: r.created ? r.xp / r.created : 0,
      created25: r.points ? (r.created / r.points) * PER : 0,
      assists25: r.points ? (r.assists / r.points) * PER : 0,
    }))
    .sort((a, b) => b.created25 - a.created25 || b.created - a.created)
  return { rows, league: { passed, passedFg: passed ? passedMade / passed : null, otherFg: other ? otherMade / other : null } }
}

// 3. Win probability added ----------------------------------------------------------------------------------------
const phi = (z: number) => {
  // Abramowitz and Stegun 26.2.17
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z > 0 ? 1 - p : p
}
export const CREDIT = { scorer: 0.65, assister: 0.35 } // an assisted basket is shared; an unassisted one is all the scorer's

// The chance the team ahead by `margin` goes on to win when `left` points of scoring remain: the margin is a random walk
// over the baskets still to come, each worth `sq` squared points on average.
export const winChance = (margin: number, left: number, sq: number) => phi(margin / Math.sqrt(Math.max(left, 1) * sq))

export interface Swing {
  gameId: string
  date: string
  id: string
  points: number
  from: number
  to: number
}
export interface PlayerWpa {
  id: string
  games: number
  baskets: number
  added: number // win chance gained by their baskets and passes, in whole games
  allowed: number // win chance given up on baskets scored against them while they defended
  net: number
  added25: number // the same, per 25 combined points
  allowed25: number
  net25: number
}
export interface Wpa {
  games: number
  expectedTotal: number
  rows: PlayerWpa[]
  swings: Swing[]
}

const orderOf = (g: Game) => (g.scoringEvents.every((e) => typeof e.videoTime === "number") ? [...g.scoringEvents].sort((a, b) => (a.videoTime as number) - (b.videoTime as number)) : g.scoringEvents)

export function winProbAdded(state: PooleanState): Wpa {
  const gs = games(state)
  const totals = gs.map(total).sort((a, b) => a - b)
  const expectedTotal = totals.length ? totals[Math.floor((totals.length - 1) / 2)] : 0
  const made2 = gs.flatMap((g) => g.scoringEvents.filter(made).map((e) => e.points * e.points))
  const sq = made2.length ? made2.reduce((a, b) => a + b, 0) / made2.length : 4
  const by = new Map<string, { games: number; baskets: number; added: number; allowed: number; points: number }>()
  const row = (id: string) => by.get(id) ?? by.set(id, { games: 0, baskets: 0, added: 0, allowed: 0, points: 0 }).get(id)!
  const swings: Swing[] = []
  for (const g of gs) {
    const final = score(g)
    const winner = final[0] > final[1] ? 0 : 1
    for (const id of members(g)) {
      const r = row(id)
      r.games++
      r.points += final[0] + final[1]
    }
    const run: [number, number] = [0, 0]
    const order = orderOf(g).filter((e) => made(e) && side(g, e.scorerId) !== null)
    order.forEach((e, i) => {
      const t = side(g, e.scorerId) as 0 | 1
      const left = Math.max(expectedTotal, final[0] + final[1]) - (run[0] + run[1])
      const from = winChance(run[t] - run[1 - t], left, sq)
      run[t] += e.points
      const to = i === order.length - 1 ? (t === winner ? 1 : 0) : winChance(run[t] - run[1 - t], left - e.points, sq)
      const d = to - from
      const passer = e.assistId && side(g, e.assistId) === t && e.assistId !== e.scorerId ? e.assistId : null
      row(e.scorerId).baskets++
      row(e.scorerId).added += d * (passer ? CREDIT.scorer : 1)
      if (passer) row(passer).added += d * CREDIT.assister
      const defenders = (e.defenderIds ?? []).filter((x) => side(g, x) === 1 - t)
      for (const x of defenders) row(x).allowed += d / defenders.length
      swings.push({ gameId: g.id, date: g.date, id: e.scorerId, points: e.points, from, to })
    })
  }
  const rows = [...by]
    .filter(([, r]) => r.baskets > 0 || r.added !== 0)
    .map(([id, r]) => ({ id, games: r.games, baskets: r.baskets, added: r.added, allowed: r.allowed, net: r.added - r.allowed, added25: r.points ? (r.added / r.points) * PER : 0, allowed25: r.points ? (r.allowed / r.points) * PER : 0, net25: r.points ? ((r.added - r.allowed) / r.points) * PER : 0 }))
    .sort((a, b) => b.net25 - a.net25)
  return { games: gs.length, expectedTotal, rows, swings: swings.sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, 3) }
}

// 4. What a turnover costs ----------------------------------------------------------------------------------------
// A possession is a shot minus the offensive rebounds that extend it, plus the turnovers that end it with no shot (a shot
// that is stolen or blocked is already a shot, so it is not counted twice). The league's points per possession is what a
// giveaway is worth. With video times, the other team's very next shot shows what turnovers actually cost. Every count
// here is live-ball turnovers only.
export interface TovRow {
  id: string
  games: number
  giveaways: number
  forced: number
  handed: number // points the other team scored on its next shot after their giveaways
  taken: number // points their team scored on its next shot after turnovers they forced
  net25: number // points per 25 from forcing more than they give away, at the league's points per possession
}
export interface TovCost {
  games: number
  possessions: number
  perPossession: number
  turnovers: number
  perTurnover: number | null // measured: points on the other team's next shot, over turnovers followed by one
  followed: number // turnovers that were followed by a shot from the other team
  rows: TovRow[]
}

export function turnoverCost(state: PooleanState): TovCost {
  const gs = games(state)
  let poss = 0
  let points = 0
  let tovs = 0
  let off = 0
  let followed = 0
  const by = new Map<string, { games: number; giveaways: number; forced: number; handed: number; taken: number; points: number }>()
  const row = (id: string) => by.get(id) ?? by.set(id, { games: 0, giveaways: 0, forced: 0, handed: 0, taken: 0, points: 0 }).get(id)!
  for (const g of gs) {
    const live = liveTurnovers(g)
    const oreb = members(g).reduce((n, id) => n + getGameStats(g, id).oreb, 0)
    poss += g.scoringEvents.length - oreb + live.length
    points += total(g)
    tovs += live.length
    for (const id of members(g)) {
      row(id).games++
      row(id).points += total(g)
    }
    for (const x of live) {
      if (side(g, x.playerId) !== null) row(x.playerId).giveaways++
      if (x.opponentId && side(g, x.opponentId) !== null) row(x.opponentId).forced++
    }
    // The next play after each turnover, in video time. A game without times for every play cannot say.
    const timed = g.scoringEvents.every((e) => typeof e.videoTime === "number") && g.turnoverEvents.every((x) => typeof x.videoTime === "number")
    if (!timed) continue
    type Play = { t: number; shot: ScoringEvent | null; who: string; tov?: TurnoverEvent }
    const plays: Play[] = [
      ...g.scoringEvents.map((e) => ({ t: e.videoTime as number, shot: e as ScoringEvent | null, who: e.scorerId })),
      ...live.map((x) => ({ t: x.videoTime as number, shot: null, who: x.playerId, tov: x })),
    ].sort((a, b) => a.t - b.t)
    for (const [i, p] of plays.entries()) {
      if (!p.tov) continue
      const next = plays.slice(i + 1).find((q) => q.t > p.t)
      const mine = side(g, p.who)
      if (!next || !next.shot || mine === null || side(g, next.who) !== 1 - mine) continue
      followed++
      off += pts(next.shot)
      row(p.who).handed += pts(next.shot)
      const forcer = p.tov.opponentId
      if (forcer && side(g, forcer) !== null) row(forcer).taken += pts(next.shot)
    }
  }
  const pp = poss > 0 ? points / poss : 0
  const rows = [...by]
    .filter(([, r]) => r.giveaways > 0 || r.forced > 0)
    .map(([id, r]) => ({ id, games: r.games, giveaways: r.giveaways, forced: r.forced, handed: r.handed, taken: r.taken, net25: r.points ? (((r.forced - r.giveaways) * pp) / r.points) * PER : 0 }))
    .sort((a, b) => b.net25 - a.net25)
  return { games: gs.length, possessions: poss, perPossession: pp, turnovers: tovs, perTurnover: followed ? off / followed : null, followed, rows }
}

// Every player's games from their own team's side, for a table. `margin` is their team's average margin (negative when
// they lost by more than they won by), and `edge` the average points each factor gave their team.
export interface PlayerParts {
  id: string
  games: number
  margin: number
  edge: Record<Factor, number>
}

export function playerBreakdowns(state: PooleanState): PlayerParts[] {
  const gs = games(state)
  const expect = yardstick(gs)
  const by = new Map<string, PlayerParts>()
  for (const g of gs) {
    const p = partsOf(g, expect)
    if (!p) continue
    for (const id of members(g)) {
      const view = side(g, id) === 0 ? 1 : -1
      const r = by.get(id) ?? by.set(id, { id, games: 0, margin: 0, edge: { quality: 0, making: 0, turnovers: 0, rebounds: 0, other: 0 } }).get(id)!
      r.games++
      r.margin += p.margin * view
      for (const f of FACTORS) r.edge[f] += p.parts[f] * view
    }
  }
  return [...by.values()]
    .map((r) => ({ ...r, margin: r.margin / r.games, edge: Object.fromEntries(FACTORS.map((f) => [f, r.edge[f] / r.games])) as Record<Factor, number> }))
    .sort((a, b) => b.margin - a.margin)
}
