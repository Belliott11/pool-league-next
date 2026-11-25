import { CREDIT, games } from "@/lib/insight"
import { PER, gamePace } from "@/lib/per"
import { sameMathRules } from "@/lib/rulebook"
import { defendersOf } from "@/lib/matchupRecord"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// Points added: every play valued by how far it moves what the trip is worth. A trip with the ball (a turn with it, see possessions.ts)
// is worth the league's points per trip, `ep`. A shot moves that to the points it scores, or, when it misses, to what the miss is worth:
// nothing if it goes out of bounds (the other team's ball, logged as a turnover with `missEventId`), and otherwise the chance the
// shooting team gets it back times `ep`. The rebound then settles it: an offensive rebound earns the rest of `ep`, a defensive rebound
// takes away what the miss was still worth. A live-ball turnover costs `ep`, and forcing one earns it. The defender on a shot takes the
// other side of its value (a make against them costs what it earned the shooter, a miss earns what it cost), so defense is scored the
// same way as offense. Over the league, the offense's
// credits add up to the points scored less `ep` per trip, which is zero, so a player's total says how many points they added beyond
// an average trip. Free throws are rare and left out.

const made = (e: ScoringEvent) => e.made !== false
const side = (g: Game, id: string | null | undefined): 0 | 1 | null => (!id ? null : g.teamA.includes(id) ? 0 : g.teamB.includes(id) ? 1 : null)
const isShot = (e: ScoringEvent) => e.points === 2 || e.points === 3

export type MissEnd = "made" | "out" | "kept" | "lost"

// Where a shot ended: in, out of bounds, back with the shooting team (an offensive rebound, or a block that went out off the defense
// with no rebounder), or with the defense.
export function shotEnd(g: Game, e: ScoringEvent, out: Set<string>): MissEnd {
  if (made(e)) return "made"
  if (out.has(e.id)) return "out"
  const s = side(g, e.scorerId)
  if (!e.turnoverEventId && e.rebounderId && side(g, e.rebounderId) === s) return "kept"
  if (!e.turnoverEventId && !e.rebounderId && e.blockerId) return "kept"
  return "lost"
}

const liveTurnovers = (g: Game) => {
  const onShot = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
  return g.turnoverEvents.filter((t) => !t.missEventId && !onShot.has(t.id))
}

export interface Values {
  ep: number // points a trip is worth
  trips: number
  keep2: number // chance an in-bounds missed 2 comes back to the shooting team
  keep3: number
}

export function leagueValues(gs: Game[]): Values {
  let trips = 0
  let points = 0
  const misses = { 2: 0, 3: 0 }
  const kept = { 2: 0, 3: 0 }
  for (const g of gs) {
    const out = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean) as string[])
    for (const e of g.scoringEvents) {
      if (!isShot(e) || side(g, e.scorerId) === null) continue
      trips++
      const end = shotEnd(g, e, out)
      if (end === "made") points += e.points
      else if (end !== "out") {
        misses[e.points as 2 | 3]++
        if (end === "kept") {
          kept[e.points as 2 | 3]++
          trips--
        }
      }
    }
    trips += liveTurnovers(g).filter((t) => side(g, t.playerId) !== null).length
  }
  return {
    ep: trips ? points / trips : 0,
    trips,
    keep2: misses[2] ? kept[2] / misses[2] : 0.25,
    keep3: misses[3] ? kept[3] / misses[3] : 0.12,
  }
}

export interface Parts {
  shots: number
  passes: number
  turnovers: number
  boards: number // offensive rebounds
  defense: number // shots guarded, defensive rebounds and forced turnovers
}
const blankParts = (): Parts => ({ shots: 0, passes: 0, turnovers: 0, boards: 0, defense: 0 })

export interface EpaRow {
  id: string
  games: number
  used: number // trips they ended: their shots plus their live-ball turnovers
  parts: Parts // totals
  total: number
  offense: number
  perTrip: number // offense per trip used
  perGame: number // total per average game (per.ts)
  perGameParts: Parts
}

export interface ShotRow {
  key: string
  label: string
  att: number
  epa: number // per attempt, full credit (passes not split off)
}

export interface Epa {
  values: Values
  games: number
  rows: EpaRow[]
  byShot: ShotRow[]
  play: { label: string; n: number; epa: number }[] // what each kind of play is worth on average
}

const CONTEST: Record<string, string> = { none: "No contest", beat: "Defender beaten", light: "Light contest", medium: "Medium contest", heavy: "Heavy contest" }
const TYPE: Record<string, string> = { catchAndShoot: "Catch and shoot", drive: "Drive", move: "Move", dunk: "Dunk", deepHeave: "Deep heave" }

export function pointsAdded(state: PooleanState, opts: { only?: string } = {}): Epa {
  const gs = games(state)
  // What a trip is worth comes from the games under the newest scoring, possession and out-of-bounds rules (rulebook.ts), once
  // they have enough games; until then from every game.
  const newest = gs.map((g) => g.date || "").sort().at(-1)
  const v = leagueValues(sameMathRules(gs, newest))
  const keep = (k: number) => (k === 2 ? v.keep2 : v.keep3)
  const by = new Map<string, { games: number; used: number; pace: number; parts: Parts }>()
  const row = (id: string) => by.get(id) ?? by.set(id, { games: 0, used: 0, pace: 0, parts: blankParts() }).get(id)!
  const shotTally = new Map<string, { label: string; att: number; sum: number }>()
  const tally = (key: string, label: string, x: number) => {
    const t = shotTally.get(key) ?? shotTally.set(key, { label, att: 0, sum: 0 }).get(key)!
    t.att++
    t.sum += x
  }
  const play = { two: { n: 0, s: 0 }, three: { n: 0, s: 0 }, tov: { n: 0, s: 0 }, oreb: { n: 0, s: 0 }, dreb: { n: 0, s: 0 }, out: { n: 0, s: 0 } }

  // One game's plays (for its summary), valued at the league's rates; any filmed game, even uneven ones.
  const counted = opts.only ? state.games.filter((g) => g.id === opts.only && g.scoringEvents.length > 0) : gs
  for (const g of counted) {
    const total = g.scoringEvents.reduce((n, e) => n + (made(e) ? e.points : 0), 0)
    const pace = gamePace(g, total)
    for (const id of [...g.teamA, ...g.teamB]) {
      row(id).games++
      row(id).pace += pace
    }
    const out = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean) as string[])
    for (const e of g.scoringEvents) {
      const s = side(g, e.scorerId)
      if (!isShot(e) || s === null) continue
      const end = shotEnd(g, e, out)
      // The shot's own value: what it left the trip worth, less what the trip was worth.
      const left = end === "made" ? e.points : end === "out" ? 0 : keep(e.points) * v.ep
      const shot = left - v.ep
      const shooter = row(e.scorerId)
      shooter.used++
      const passer = made(e) && e.assistId && e.assistId !== e.scorerId && side(g, e.assistId) === s ? e.assistId : null
      shooter.parts.shots += shot * (passer ? CREDIT.scorer : 1)
      if (passer) row(passer).parts.passes += shot * CREDIT.assister
      const p = e.points === 2 ? play.two : play.three
      p.n++
      p.s += shot
      if (end === "out") {
        play.out.n++
        play.out.s += shot
      }
      // The defenders logged on the shot take the other side of its value, shared when two guarded it.
      // The same rule as Who stops whom: tagged defenders, else the matchups list on a contested shot (matchupRecord.ts).
      const guards = defendersOf(g, e).filter((x) => side(g, x) === 1 - s)
      for (const x of guards) row(x).parts.defense -= shot / guards.length
      tally(`pts${e.points}`, e.points === 2 ? "All 2s" : "All 3s", shot)
      if (e.contestLevel) tally(`${e.points}-c-${e.contestLevel}`, `${e.points}s, ${(CONTEST[e.contestLevel] ?? e.contestLevel).toLowerCase()}`, shot)
      if (e.shotType && TYPE[e.shotType]) tally(`t-${e.shotType}`, TYPE[e.shotType], shot)
      // The rebound settles an in-bounds miss.
      if (end === "kept" && e.rebounderId && side(g, e.rebounderId) === s) {
        const x = (1 - keep(e.points)) * v.ep
        row(e.rebounderId).parts.boards += x
        play.oreb.n++
        play.oreb.s += x
      } else if (end === "lost" && !e.turnoverEventId && e.rebounderId && side(g, e.rebounderId) === 1 - s) {
        const x = keep(e.points) * v.ep
        row(e.rebounderId).parts.defense += x
        play.dreb.n++
        play.dreb.s += x
      }
    }
    for (const t of liveTurnovers(g)) {
      if (side(g, t.playerId) === null) continue
      const r = row(t.playerId)
      r.used++
      r.parts.turnovers -= v.ep
      play.tov.n++
      play.tov.s -= v.ep
      if (t.opponentId && side(g, t.opponentId) !== null && side(g, t.opponentId) !== side(g, t.playerId)) row(t.opponentId).parts.defense += v.ep
    }
  }

  const sum = (p: Parts) => p.shots + p.passes + p.turnovers + p.boards + p.defense
  const scale = (p: Parts, pace: number): Parts => {
    const f = pace ? PER / pace : 0
    return { shots: p.shots * f, passes: p.passes * f, turnovers: p.turnovers * f, boards: p.boards * f, defense: p.defense * f }
  }
  const rows: EpaRow[] = [...by]
    .filter(([, r]) => r.used > 0)
    .map(([id, r]) => {
      const offense = r.parts.shots + r.parts.passes + r.parts.turnovers + r.parts.boards
      const total = sum(r.parts)
      return { id, games: r.games, used: r.used, parts: r.parts, total, offense, perTrip: r.used ? (r.parts.shots + r.parts.turnovers) / r.used : 0, perGame: r.pace ? (total / r.pace) * PER : 0, perGameParts: scale(r.parts, r.pace) }
    })
    .sort((a, b) => b.perGame - a.perGame)
  const avg = (x: { n: number; s: number }) => (x.n ? x.s / x.n : 0)
  return {
    values: v,
    games: gs.length,
    rows,
    byShot: [...shotTally].map(([key, t]) => ({ key, label: t.label, att: t.att, epa: t.att ? t.sum / t.att : 0 })),
    play: [
      { label: "A 2", n: play.two.n, epa: avg(play.two) },
      { label: "A 3", n: play.three.n, epa: avg(play.three) },
      { label: "A miss out of bounds", n: play.out.n, epa: avg(play.out) },
      { label: "A live-ball turnover", n: play.tov.n, epa: avg(play.tov) },
      { label: "An offensive rebound", n: play.oreb.n, epa: avg(play.oreb) },
      { label: "A defensive rebound", n: play.dreb.n, epa: avg(play.dreb) },
    ],
  }
}
