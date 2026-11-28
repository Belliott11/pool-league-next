import { compareMeans, compareRates, type Mean, type Rate, type Verdict } from "@/lib/gameFlow"
import { ruleChanges, type RuleChange } from "@/lib/rulebook"
import type { Game, PooleanState } from "@/lib/types"

// "Did the rule change work?" The games before a rulebook change against the games after it, on what the change is likely to move.
// The league's expected changes are to defense and what contact is a foul, so those come first: fouls, roughness free throws, steals,
// turnovers, how hard shots are contested and how often defenders get beaten, then what that does to scoring. Every comparison says
// how sure it is (gameFlow.ts verdicts), so a three-game trial is not oversold.

export const MIN_SIDE_GAMES = 3 // games each side needs before the card shows
const MIN_EVENTS = 5 // fouls, steals and the like, both sides together, before a count can say anything

export interface ImpactRow {
  group: "Defense and contact" | "Scoring" | "Game shape"
  label: string
  before: string
  after: string
  change: string // in words, with the unit
  verdict: Verdict
}

export interface RuleImpact {
  change: RuleChange
  before: number // games
  after: number
  rows: ImpactRow[]
}

const made = (e: Game["scoringEvents"][number]) => e.made !== false
const isShot = (e: Game["scoringEvents"][number]) => e.points === 2 || e.points === 3

interface Side {
  games: number
  trips: number
  fouls: number
  ft: number // free-throw attempts (one-point shots: roughness penalties)
  steals: number
  liveTov: number
  shots: Rate
  contested: Rate // shots with a contest level: made = heavily contested
  beaten: Rate // shots with a contest level: made = the defender got beaten
  oreb: Rate // in-bounds misses: made = the shooting team got it back
  out: Rate // misses: made = out of bounds
  threes: Rate // 3s taken: made = went in
  threeShare: Rate // shots: made = it was a 3
  ppt: Mean // points per trip, one value per game
  length: Mean // trips per game
}

const blank = (): Side => ({ games: 0, trips: 0, fouls: 0, ft: 0, steals: 0, liveTov: 0, shots: { made: 0, att: 0 }, contested: { made: 0, att: 0 }, beaten: { made: 0, att: 0 }, oreb: { made: 0, att: 0 }, out: { made: 0, att: 0 }, threes: { made: 0, att: 0 }, threeShare: { made: 0, att: 0 }, ppt: { sum: 0, sq: 0, n: 0 }, length: { sum: 0, sq: 0, n: 0 } })
const addMean = (m: Mean, x: number) => {
  m.sum += x
  m.sq += x * x
  m.n++
}

function tally(gs: Game[]): Side {
  const s = blank()
  for (const g of gs) {
    const sideOf = (id: string | null | undefined) => (!id ? null : g.teamA.includes(id) ? 0 : g.teamB.includes(id) ? 1 : null)
    const outIds = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean))
    const onShot = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
    let trips = 0
    let points = 0
    for (const e of g.scoringEvents) {
      if (e.points === 1) {
        s.ft++
        if (made(e)) points += 1
        continue
      }
      if (!isShot(e)) continue
      trips++
      s.shots.att++
      s.threeShare.att++
      if (e.points === 3) {
        s.threeShare.made++
        s.threes.att++
        if (made(e)) s.threes.made++
      }
      if (made(e)) {
        s.shots.made++
        points += e.points
      } else {
        s.out.att++
        if (outIds.has(e.id)) s.out.made++
        else if (!e.turnoverEventId) {
          s.oreb.att++
          if (e.rebounderId && sideOf(e.rebounderId) === sideOf(e.scorerId)) {
            s.oreb.made++
            trips--
          }
        }
      }
      if (e.contestLevel) {
        s.contested.att++
        s.beaten.att++
        if (e.contestLevel === "heavy") s.contested.made++
        if (e.contestLevel === "beat") s.beaten.made++
      }
    }
    const live = g.turnoverEvents.filter((t) => !t.missEventId && !onShot.has(t.id)).length
    trips += live
    s.liveTov += live
    s.fouls += g.foulEvents?.length ?? 0
    s.steals += g.stealEvents?.length ?? 0
    s.trips += trips
    s.games++
    if (trips > 0) {
      addMean(s.ppt, points / trips)
      addMean(s.length, trips)
    }
  }
  return s
}

const pct = (r: Rate) => (r.att ? `${Math.round((r.made / r.att) * 100)}%` : "-")
const per10 = (n: number, trips: number) => (trips ? ((n / trips) * 10).toFixed(1) : "-")
const avg = (m: Mean, d = 2) => (m.n ? (m.sum / m.n).toFixed(d) : "-")
const signedPts = (d: number | null, unit: string) => (d === null ? "too few to compare" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} ${unit}`)

export function ruleImpact(state: PooleanState, change: RuleChange | undefined = ruleChanges().at(-1)): RuleImpact | null {
  if (!change?.version.from) return null
  const from = change.version.from
  // Only the games under the version just before this change, so an older change does not muddy it.
  const prevFrom = change.previous.from ?? ""
  // Every filmed game, uneven teams included: fouls, contests and turnovers are about the rules, not about a fair matchup.
  const all = state.games.filter((g) => g.scoringEvents.length > 0 && !g.liveInProgress)
  const beforeGames = all.filter((g) => (g.date || "") < from && (g.date || "") >= prevFrom)
  const next = ruleChanges().find((c) => (c.version.from ?? "") > from)
  const afterGames = all.filter((g) => (g.date || "") >= from && (!next?.version.from || (g.date || "") < next.version.from))
  if (beforeGames.length < MIN_SIDE_GAMES || afterGames.length < MIN_SIDE_GAMES) return { change, before: beforeGames.length, after: afterGames.length, rows: [] }
  return { change, before: beforeGames.length, after: afterGames.length, rows: compareGames(beforeGames, afterGames) }
}

// Two sets of filmed games side by side on what rules move: also used for trial rules (ruleTrials.ts).
export function compareGames(beforeGames: Game[], afterGames: Game[]): ImpactRow[] {
  const a = tally(beforeGames)
  const b = tally(afterGames)
  // A count per trip, as a rate, so games of different lengths compare fairly.
  const perTrip = (label: string, x: number, y: number): ImpactRow => {
    const c = compareRates({ made: x, att: a.trips }, { made: y, att: b.trips })
    // A handful of events (one foul in ten games) is no evidence either way, whatever the rate test says.
    const verdict = x + y < MIN_EVENTS ? "early" : c.verdict
    return { group: "Defense and contact", label: `${label} per 10 trips`, before: per10(x, a.trips), after: per10(y, b.trips), change: signedPts(c.diff === null ? null : c.diff / 10, "per 10 trips"), verdict }
  }
  const rate = (group: ImpactRow["group"], label: string, x: Rate, y: Rate): ImpactRow => {
    const c = compareRates(x, y)
    return { group, label, before: pct(x), after: pct(y), change: signedPts(c.diff, "points"), verdict: c.verdict }
  }
  const mean = (label: string, x: Mean, y: Mean, d: number, unit: string): ImpactRow => {
    const c = compareMeans(x, y)
    return { group: label === "Trips per game" ? "Game shape" : "Scoring", label, before: avg(x, d), after: avg(y, d), change: c.diff === null ? "too few to compare" : `${c.diff > 0 ? "+" : c.diff < 0 ? "−" : ""}${Math.abs(c.diff).toFixed(d)} ${unit}`, verdict: c.verdict }
  }
  return [
    perTrip("Fouls called", a.fouls, b.fouls),
    perTrip("Roughness free throws", a.ft, b.ft),
    perTrip("Steals", a.steals, b.steals),
    perTrip("Live-ball turnovers", a.liveTov, b.liveTov),
    rate("Defense and contact", "Shots heavily contested", a.contested, b.contested),
    rate("Defense and contact", "Shots where the defender got beaten", a.beaten, b.beaten),
    rate("Scoring", "Shots made (2s and 3s)", a.shots, b.shots),
    rate("Scoring", "3s made", a.threes, b.threes),
    rate("Scoring", "Shots that are 3s", a.threeShare, b.threeShare),
    mean("Points per trip", a.ppt, b.ppt, 2, "points"),
    rate("Scoring", "Missed shots the shooting team got back", a.oreb, b.oreb),
    rate("Scoring", "Missed shots out of bounds", a.out, b.out),
    mean("Trips per game", a.length, b.length, 1, "trips"),
  ]
}
