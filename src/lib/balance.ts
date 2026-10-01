// Balance Teams engine, ported verbatim from app.js (computeBalanceQualityMap ...
// generateBalancedTeamSets). Reads the real-site data for the latest season, as the classic site's
// header season picker does by default.
import { predictRealMatchup, getRealMatchupModel, worstPairingGap, UNKNOWN_PLAYER_PCT } from "./matchup"
import { currentRealSeason } from "./real"
import {
  computeLeaderboard,
  computeMatchupCells,
  computeTeammateSynergy,
  isQualifyingGame,
  playerGameResult,
} from "./stats"
import type { PooleanState } from "./types"

// ---- Reputation fallback (real power-ranking percentile, for players with no logged games) ----
const PLAYER_REPUTATION_DATA = [
  { slug: "phillip", avgPercentile: 100, parties: 4 },
  { slug: "logan-hoskins", avgPercentile: 88.9, parties: 1 },
  { slug: "ben", avgPercentile: 73.3, parties: 15 },
  { slug: "reilly", avgPercentile: 73, parties: 7 },
  { slug: "evan", avgPercentile: 65.1, parties: 4 },
  { slug: "adam", avgPercentile: 63.2, parties: 15 },
  { slug: "sean", avgPercentile: 63, parties: 3 },
  { slug: "jason", avgPercentile: 52.9, parties: 3 },
  { slug: "zach", avgPercentile: 42.1, parties: 15 },
  { slug: "alex", avgPercentile: 35.6, parties: 9 },
  { slug: "will", avgPercentile: 35.5, parties: 6 },
  { slug: "g-ian", avgPercentile: 20.8, parties: 3 },
  { slug: "logan-watson", avgPercentile: 16.2, parties: 3 },
  { slug: "viraj", avgPercentile: 15.3, parties: 3 },
  { slug: "g-lukas", avgPercentile: 8.3, parties: 3 },
  { slug: "ryder", avgPercentile: 0, parties: 2 },
  { slug: "kayla", avgPercentile: 0, parties: 2 },
  { slug: "g-michael-t", avgPercentile: 0, parties: 1 },
  { slug: "g-danny", avgPercentile: 0, parties: 1 },
]
const PLAYER_REPUTATION_BY_ID: Record<string, { avgPercentile: number; parties: number }> = {}
PLAYER_REPUTATION_DATA.forEach((r) => {
  PLAYER_REPUTATION_BY_ID[r.slug] = r
})

// ---- Ben's scouting: height (in), build 1-5, effort 1-4, roles. Only ever a tiebreaker. ----
export interface PhysicalData {
  heightIn: number
  build: number
  effort?: number
  roles: string[]
  note?: string
}
const PLAYER_PHYSICAL_DATA: Record<string, PhysicalData> = {
  ben: { heightIn: 72, build: 3, effort: 4, roles: ["defender", "playmaker"] },
  adam: { heightIn: 64, build: 5, effort: 4, roles: ["scorer", "defender"] },
  zach: { heightIn: 67, build: 1, effort: 4, roles: ["scorer"] },
  alex: { heightIn: 72, build: 3, effort: 4, roles: ["scorer"] },
  evan: { heightIn: 69, build: 4, effort: 3, roles: ["scorer"] },
  "g-ian": { heightIn: 70, build: 4, effort: 3, roles: ["physical"] },
  "g-michael-t": { heightIn: 70, build: 2, effort: 2, roles: ["scorer"] },
  "g-lukas": { heightIn: 67, build: 3, effort: 3, roles: ["physical", "defender"] },
  reilly: { heightIn: 71, build: 3, effort: 2, roles: ["scorer"] },
  viraj: { heightIn: 69, build: 2, effort: 2, roles: ["role-player"] },
  sean: { heightIn: 72, build: 4, effort: 3, roles: ["defender", "scorer"] },
  will: { heightIn: 68, build: 4, effort: 3, roles: ["physical"] },
  phillip: { heightIn: 73, build: 4, effort: 4, roles: ["scorer", "defender"] },
  jason: { heightIn: 70, build: 2, effort: 3, roles: ["defender"] },
  "logan-hoskins": { heightIn: 72, build: 4, effort: 1, roles: ["defender", "scorer"] },
  "logan-watson": { heightIn: 69, build: 3, effort: 3, roles: ["role-player"] },
  kayla: { heightIn: 67, build: 3, effort: 2, roles: ["role-player"] },
  ryder: { heightIn: 70, build: 2, effort: 3, roles: ["playmaker"] },
  "g-danny": { heightIn: 70, build: 5, effort: 2, roles: ["physical"] },
  "g-michael-k": { heightIn: 70, build: 2, effort: 2, roles: ["scorer"] },
}
export const PHYSICAL_ROLE_LABELS: Record<string, string> = {
  scorer: "Scorer",
  defender: "Defender",
  physical: "Physical",
  playmaker: "Playmaker",
  "role-player": "Role Player",
}
export const BUILD_LABELS: Record<number, string> = { 1: "Very Skinny", 2: "Skinny", 3: "Average", 4: "Strong", 5: "Very Strong" }
export const EFFORT_LABELS: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High", 4: "Very High" }

export function formatHeightIn(totalInches: number): string {
  const rounded = Math.round(totalInches)
  return `${Math.floor(rounded / 12)}'${rounded % 12}"`
}

// state.playerPhysicalOverrides (edited from the classic site's Players tab) wins whole-object.
export function getPlayerPhysicalData(state: PooleanState, id: string): PhysicalData | undefined {
  const overrides = state.playerPhysicalOverrides as Record<string, PhysicalData> | undefined
  return overrides?.[id] || PLAYER_PHYSICAL_DATA[id]
}

const CLEAN_SWEEP_BONUS = 1.2
export function estimatedQualityFromReputation(avgPercentile: number, parties: number): number {
  const base = (avgPercentile - 50) / 10
  return avgPercentile === 100 && parties >= 2 ? base + CLEAN_SWEEP_BONUS : base
}

function computePooleanReputation(playerId: string) {
  const card = currentRealSeason()?.cards[playerId]
  if (card) return { avgPercentile: card.powerPct, parties: card.parties }
  const rep = PLAYER_REPUTATION_BY_ID[playerId]
  return rep ? { avgPercentile: rep.avgPercentile, parties: rep.parties } : null
}

export interface QualityEntry {
  quality: number
  source: "stats" | "reputation" | "none"
  avgPercentile?: number
  parties?: number
}

// Every attendee's balancing quality plus where it came from.
export function computeBalanceQualityMap(state: PooleanState): Record<string, QualityEntry> {
  const map: Record<string, QualityEntry> = {}
  computeLeaderboard(state).forEach((r) => {
    if (r.gp > 0) {
      map[r.player.id] = { quality: r.twoWayPer20, source: "stats" }
    } else {
      const rep = computePooleanReputation(r.player.id)
      map[r.player.id] = rep
        ? {
            quality: estimatedQualityFromReputation(rep.avgPercentile, rep.parties),
            source: "reputation",
            avgPercentile: rep.avgPercentile,
            parties: rep.parties,
          }
        : { quality: estimatedQualityFromReputation(UNKNOWN_PLAYER_PCT, 0), source: "none" }
    }
  })
  return map
}

// ---- Candidate generation ----
function snakeOrderIndices(targetSizes: number[], totalCount: number): number[] {
  const numTeams = targetSizes.length
  const counts: number[] = new Array(numTeams).fill(0)
  const order: number[] = []
  let i = 0
  let dir = 1
  while (order.length < totalCount) {
    if (counts[i] < targetSizes[i]) {
      order.push(i)
      counts[i]++
    }
    const next = i + dir
    if (next < 0 || next >= numTeams) dir = -dir
    else i = next
  }
  return order
}

function snakeDraftTeams(sortedIds: string[], targetSizes: number[]): string[][] {
  const order = snakeOrderIndices(targetSizes, sortedIds.length)
  const teams: string[][] = targetSizes.map(() => [])
  sortedIds.forEach((id, i) => teams[order[i]].push(id))
  return teams
}

function randomGreedyTeams(attendeeIds: string[], targetSizes: number[], qualityById: Record<string, number>): string[][] {
  const shuffled = [...attendeeIds].sort(() => Math.random() - 0.5)
  const teams: string[][] = targetSizes.map(() => [])
  const totals: number[] = targetSizes.map(() => 0)
  shuffled.forEach((id) => {
    let best = -1
    let bestAvg = Infinity
    teams.forEach((team, i) => {
      if (team.length >= targetSizes[i]) return
      const avg = team.length > 0 ? totals[i] / team.length : -Infinity
      if (avg < bestAvg) {
        bestAvg = avg
        best = i
      }
    })
    teams[best].push(id)
    totals[best] += qualityById[id] || 0
  })
  return teams
}

function teamSetSignature(teams: string[][]): string {
  return teams.map((t) => [...t].sort().join(",")).sort().join("|")
}

// ---- Chemistry / past record ----
type LiftMap = Record<string, { value: number; gp: number }>
type WinRateMap = Record<string, { value: number; gp: number; real: boolean }>

// How each attendee's own Two-Way/20 actually changed with each other attendee on their team.
export function computeChemistryLiftMap(state: PooleanState, attendeeIds: string[]): LiftMap {
  const map: LiftMap = {}
  attendeeIds.forEach((playerId) => {
    computeTeammateSynergy(state, playerId).forEach((r) => {
      if (!attendeeIds.includes(r.teammate.id)) return
      if (r.with.gp === 0 || r.without.gp === 0) return
      const lift = r.with.twoWayPer20 - r.without.twoWayPer20
      const confidence = Math.min(1, r.with.gp / 3)
      map[`${playerId}|${r.teammate.id}`] = { value: lift * confidence, gp: r.with.gp }
    })
  })
  return map
}

export function teamChemistryAdjustment(team: string[], liftMap: LiftMap) {
  if (team.length < 2) return { value: 0, minGp: null as number | null }
  let sum = 0
  let count = 0
  let minGp: number | null = null
  team.forEach((a) =>
    team.forEach((b) => {
      if (a === b) return
      const entry = liftMap[`${a}|${b}`]
      if (entry !== undefined) {
        sum += entry.value
        count++
        minGp = minGp === null ? entry.gp : Math.min(minGp, entry.gp)
      }
    }),
  )
  return { value: count > 0 ? sum / count : 0, minGp }
}

// Win rate of every attendee pair that shared a team, converted to a Two-Way/20-scale adjustment.
// Prefers the real site's full pairwise history over this app's own logged subset.
export function computeTeamWinRateMap(state: PooleanState, attendeeIds: string[]): WinRateMap {
  const map: WinRateMap = {}
  const qualifyingGames = state.games.filter(isQualifyingGame)
  const realTogether = currentRealSeason()?.together
  for (let i = 0; i < attendeeIds.length; i++) {
    for (let j = i + 1; j < attendeeIds.length; j++) {
      const [a, b] = [attendeeIds[i], attendeeIds[j]]
      let gp: number
      let winPct: number
      const real = realTogether ? realTogether[[a, b].sort().join("|")] : null
      if (real) {
        gp = real.gp
        winPct = (real.w / real.gp) * 100
      } else {
        let wins = 0
        let losses = 0
        let ties = 0
        qualifyingGames.forEach((g) => {
          const together =
            (g.teamA.includes(a) && g.teamA.includes(b)) || (g.teamB.includes(a) && g.teamB.includes(b))
          if (!together) return
          const result = playerGameResult(g, a)
          if (result === "W") wins++
          else if (result === "L") losses++
          else if (result === "T") ties++
        })
        gp = wins + losses + ties
        if (gp === 0) continue
        winPct = ((wins + ties * 0.5) / gp) * 100
      }
      const confidence = Math.min(1, gp / 3)
      map[`${a}|${b}`] = { value: ((winPct - 50) / 10) * confidence, gp, real: !!real }
    }
  }
  return map
}

export function teamWinRateAdjustment(team: string[], winRateMap: WinRateMap) {
  if (team.length < 2) return { value: 0, minGp: null as number | null, anyReal: false }
  let sum = 0
  let count = 0
  let minGp: number | null = null
  let anyReal = false
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const key = team[i] < team[j] ? `${team[i]}|${team[j]}` : `${team[j]}|${team[i]}`
      const entry = winRateMap[key]
      if (entry !== undefined) {
        sum += entry.value
        count++
        minGp = minGp === null ? entry.gp : Math.min(minGp, entry.gp)
        if (entry.real) anyReal = true
      }
    }
  }
  return { value: count > 0 ? sum / count : 0, minGp, anyReal }
}

// A one-sided real head-to-head worth knowing about, surfaced only as a warning (never ranked on).
const REAL_AGAINST_WARNING_MIN_GP = 4
const REAL_AGAINST_WARNING_THRESHOLD = 0.75
export function computeCrossTeamRivalryWarnings(teams: string[][]) {
  const against = currentRealSeason()?.against
  if (!against) return []
  const warnings: { dominant: string; dominated: string; w: number; l: number }[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      teams[i].forEach((a) => {
        teams[j].forEach((b) => {
          const v = against[`${a}|${b}`]
          if (!v || v.gp < REAL_AGAINST_WARNING_MIN_GP) return
          if (v.w / v.gp >= REAL_AGAINST_WARNING_THRESHOLD) {
            warnings.push({ dominant: a, dominated: b, w: v.w, l: v.l ?? v.gp - v.w })
          }
        })
      })
    }
  }
  return warnings
}

// ---- Scoring ----
// Balance is judged by each team's average quality, nudged by (capped) chemistry and past record.
function scoreTeamSet(
  state: PooleanState,
  teams: string[][],
  qualityById: Record<string, number>,
  liftMap: LiftMap,
  winRateMap: WinRateMap,
  nudgeCap?: number,
) {
  const avgs = teams.map((team) => {
    const base = team.reduce((sum, id) => sum + (qualityById[id] || 0), 0) / team.length
    const nudge = teamChemistryAdjustment(team, liftMap).value + teamWinRateAdjustment(team, winRateMap).value
    const cappedNudge = nudgeCap === undefined ? nudge : Math.max(-nudgeCap, Math.min(nudgeCap, nudge))
    return base + cappedNudge
  })
  return {
    avgs,
    spread: Math.max(...avgs) - Math.min(...avgs),
    physicalScore: scorePhysicalBalance(state, teams),
  }
}

// Tiebreaker only: how far apart each team's average height/build/effort is, plus how unevenly the
// five role tags land across teams (see app.js for the weighting rationale).
function scorePhysicalBalance(state: PooleanState, teams: string[][]): number {
  const avgOf = (field: "heightIn" | "build" | "effort") => {
    const vals = teams
      .map((team) =>
        team.map((id) => getPlayerPhysicalData(state, id)?.[field]).filter((v): v is number => v !== undefined),
      )
      .filter((known) => known.length > 0)
      .map((known) => known.reduce((a, b) => a + b, 0) / known.length)
    return vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : 0
  }
  const heightSpread = avgOf("heightIn")
  const buildSpread = avgOf("build")
  const effortSpread = avgOf("effort")

  let roleImbalance = 0
  Object.keys(PHYSICAL_ROLE_LABELS).forEach((role) => {
    const countsPerTeam = teams.map(
      (team) => team.filter((id) => (getPlayerPhysicalData(state, id)?.roles || []).includes(role)).length,
    )
    const total = countsPerTeam.reduce((a, b) => a + b, 0)
    if (total === 0) return
    const mean = total / teams.length
    roleImbalance += countsPerTeam.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / teams.length
  })

  return heightSpread * 0.75 + buildSpread * 0.75 + effortSpread * 0.75 + roleImbalance * 0.75
}

function averageAttendeeHeight(state: PooleanState, attendeeIds: string[]): number | null {
  const heights = attendeeIds
    .map((id) => getPlayerPhysicalData(state, id)?.heightIn)
    .filter((h): h is number => h !== undefined)
  return heights.length > 0 ? heights.reduce((a, b) => a + b, 0) / heights.length : null
}

function teamHasAboveAverageHeight(state: PooleanState, team: string[], avgHeight: number | null): boolean {
  if (avgHeight === null) return true
  return team.some((id) => (getPlayerPhysicalData(state, id)?.heightIn ?? -Infinity) > avgHeight)
}

// Hill-climb refinement: random single-player swaps between two teams, keeping a swap only when it
// lowers the quality + chemistry + win-rate spread. Never looks at physicalScore.
function localSearchRefine(
  state: PooleanState,
  teams: string[][],
  qualityById: Record<string, number>,
  liftMap: LiftMap,
  winRateMap: WinRateMap,
  iterations: number,
  nudgeCap: number,
): string[][] {
  if (teams.length < 2) return teams
  let current = teams.map((t) => [...t])
  let currentSpread = scoreTeamSet(state, current, qualityById, liftMap, winRateMap, nudgeCap).spread
  for (let iter = 0; iter < iterations; iter++) {
    const ti = Math.floor(Math.random() * current.length)
    let tj = Math.floor(Math.random() * current.length)
    if (tj === ti) tj = (tj + 1) % current.length
    if (current[ti].length === 0 || current[tj].length === 0) continue
    const pi = Math.floor(Math.random() * current[ti].length)
    const pj = Math.floor(Math.random() * current[tj].length)
    const candidate = current.map((t) => [...t])
    ;[candidate[ti][pi], candidate[tj][pj]] = [candidate[tj][pj], candidate[ti][pi]]
    const candidateSpread = scoreTeamSet(state, candidate, qualityById, liftMap, winRateMap, nudgeCap).spread
    if (candidateSpread < currentSpread) {
      current = candidate
      currentSpread = candidateSpread
    }
  }
  return current
}

export interface BalanceOption {
  teams: string[][]
  avgs: number[]
  spread: number
  physicalScore: number
  oddsGap?: number
}

// Runs one seeded snake-draft candidate plus 300 randomized ones, dedupes, refines the best, and
// returns the 5 best splits (ranked by the Matchup Predictor's odds when it has enough games).
export function generateBalancedTeamSets(state: PooleanState, attendeeIds: string[], teamSize: number): BalanceOption[] {
  const qualityMap = computeBalanceQualityMap(state)
  const qualityById: Record<string, number> = {}
  Object.entries(qualityMap).forEach(([id, v]) => {
    qualityById[id] = v.quality
  })
  const liftMap = computeChemistryLiftMap(state, attendeeIds)
  const winRateMap = computeTeamWinRateMap(state, attendeeIds)
  const attendeeQualities = attendeeIds.map((id) => qualityById[id] || 0)
  const nudgeCap = (Math.max(...attendeeQualities) - Math.min(...attendeeQualities)) / 5

  const numTeams = Math.max(2, Math.round(attendeeIds.length / Math.max(1, teamSize)))
  const base = Math.floor(attendeeIds.length / numTeams)
  const remainder = attendeeIds.length % numTeams
  const targetSizes = Array.from({ length: numTeams }, (_, i) => base + (i < remainder ? 1 : 0))

  const sortedByQuality = [...attendeeIds].sort((a, b) => (qualityById[b] || 0) - (qualityById[a] || 0))
  const candidates = [snakeDraftTeams(sortedByQuality, targetSizes)]
  for (let i = 0; i < 300; i++) candidates.push(randomGreedyTeams(attendeeIds, targetSizes, qualityById))

  const score = (teams: string[][]) => scoreTeamSet(state, teams, qualityById, liftMap, winRateMap, nudgeCap)

  const seen = new Set<string>()
  const scored: BalanceOption[] = []
  candidates.forEach((teams) => {
    const sig = teamSetSignature(teams)
    if (seen.has(sig)) return
    seen.add(sig)
    scored.push({ teams, ...score(teams) })
  })
  scored.sort((a, b) => a.spread - b.spread)

  const refinedSeen = new Set<string>()
  const refined: BalanceOption[] = []
  scored.slice(0, 30).forEach((entry) => {
    const improvedTeams = localSearchRefine(state, entry.teams, qualityById, liftMap, winRateMap, 25, nudgeCap)
    const sig = teamSetSignature(improvedTeams)
    if (refinedSeen.has(sig)) return
    refinedSeen.add(sig)
    refined.push({ teams: improvedTeams, ...score(improvedTeams) })
  })
  refined.sort((a, b) => a.spread - b.spread)

  // How much of this group is a reputation-based guess decides how much slack the physical/role
  // tiebreaker gets (0.1 at 0% estimated up to 1.0 at 100%).
  const reputationShare =
    attendeeIds.length > 0
      ? attendeeIds.filter((id) => qualityMap[id]?.source !== "stats").length / attendeeIds.length
      : 0
  const tieTolerance = 0.1 + reputationShare * 0.9
  const avgAttendeeHeight = averageAttendeeHeight(state, attendeeIds)
  const tallFirst = (a: BalanceOption, b: BalanceOption) => {
    const aTall = a.teams.every((team) => teamHasAboveAverageHeight(state, team, avgAttendeeHeight))
    const bTall = b.teams.every((team) => teamHasAboveAverageHeight(state, team, avgAttendeeHeight))
    return aTall === bTall ? 0 : aTall ? -1 : 1
  }

  // With enough real games for the Matchup Predictor: rank by its odds, closest to 50/50 first.
  if (getRealMatchupModel()) {
    const ODDS_TIE_POINTS = 2
    const all = new Map<string, BalanceOption>()
    ;[...scored, ...refined].forEach((e) => all.set(teamSetSignature(e.teams), { ...e, oddsGap: worstPairingGap(e.teams) }))
    ;[...all.values()]
      .sort((a, b) => a.oddsGap! - b.oddsGap!)
      .slice(0, 10)
      .forEach((entry) => {
        let teams = entry.teams.map((t) => [...t])
        let gap = entry.oddsGap!
        for (let it = 0; it < 40; it++) {
          const ta = Math.floor(Math.random() * teams.length)
          const tb = (ta + 1 + Math.floor(Math.random() * (teams.length - 1))) % teams.length
          const i = Math.floor(Math.random() * teams[ta].length)
          const j = Math.floor(Math.random() * teams[tb].length)
          const cand = teams.map((t) => [...t])
          ;[cand[ta][i], cand[tb][j]] = [cand[tb][j], cand[ta][i]]
          const g = worstPairingGap(cand)
          if (g < gap) {
            teams = cand
            gap = g
          }
        }
        const sig = teamSetSignature(teams)
        if (!all.has(sig)) all.set(sig, { teams, ...score(teams), oddsGap: gap })
      })
    return [...all.values()]
      .sort((a, b) => {
        if (Math.abs(a.oddsGap! - b.oddsGap!) > ODDS_TIE_POINTS) return a.oddsGap! - b.oddsGap!
        return tallFirst(a, b) || a.physicalScore - b.physicalScore || a.spread - b.spread
      })
      .slice(0, 5)
  }

  // "Every team needs someone above today's average height" only decides between options that are
  // already practically tied on quality.
  const pool = refined.slice(0, 30)
  pool.sort((a, b) => {
    if (Math.abs(a.spread - b.spread) <= tieTolerance) return tallFirst(a, b) || a.physicalScore - b.physicalScore
    return a.spread - b.spread
  })
  return pool.slice(0, 5)
}

// Real head-to-head FG history between two rosters about to face each other, most-tested first.
export function computeCrossTeamMatchups(state: PooleanState, teamA: string[], teamB: string[]) {
  const cellFor = computeMatchupCells(state)
  const rows: { scorerId: string; defenderId: string; fgm: number; fga: number }[] = []
  const addPairs = (scorers: string[], defenders: string[]) => {
    scorers.forEach((scorerId) => {
      defenders.forEach((defenderId) => {
        const cell = cellFor(scorerId, defenderId)
        if (cell) rows.push({ scorerId, defenderId, fgm: cell.fgm, fga: cell.fga })
      })
    })
  }
  addPairs(teamA, teamB)
  addPairs(teamB, teamA)
  return rows.sort((a, b) => b.fga - a.fga)
}

// ---- Party Night Planner ----
// Each game: whoever has played the fewest games plays (random among ties), then the best of 300
// random splits scored on repeat teammates, repeat opponents and closeness to 50/50.
const PLANNER_CANDIDATES = 300

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface PlannedGame {
  a: string[]
  b: string[]
  sitting: string[]
  score: number
  pA: number | null
}

export function planPartyNight(ids: string[], perSide: number, gameCount: number, nameOf: (id: string) => string) {
  const played: Record<string, number> = Object.fromEntries(ids.map((id) => [id, 0]))
  const mates: Record<string, number> = {}
  const opps: Record<string, number> = {}
  const key = (p: string, q: string) => [p, q].sort().join("|")
  const schedule: PlannedGame[] = []
  for (let g = 0; g < gameCount; g++) {
    const spots = perSide ? Math.min(ids.length, perSide * 2) : ids.length
    const order = shuffled(ids).sort((x, y) => played[x] - played[y])
    const playing = order.slice(0, spots)
    const sitting = order.slice(spots)
    const sizeA = Math.ceil(spots / 2)
    let best: PlannedGame | null = null
    for (let c = 0; c < PLANNER_CANDIDATES; c++) {
      const mix = shuffled(playing)
      const a = mix.slice(0, sizeA)
      const b = mix.slice(sizeA)
      let repeat = 0
      ;[a, b].forEach((team) =>
        team.forEach((p, i) =>
          team.slice(i + 1).forEach((q) => {
            repeat += 2 * (mates[key(p, q)] || 0)
          }),
        ),
      )
      a.forEach((p) =>
        b.forEach((q) => {
          repeat += opps[key(p, q)] || 0
        }),
      )
      const pred = predictRealMatchup(a, b)
      const score = repeat + (pred ? Math.abs(pred.pA - 0.5) * 40 : 0)
      if (!best || score < best.score) best = { a, b, sitting, score, pA: pred ? pred.pA : null }
    }
    const chosen = best!
    ;[chosen.a, chosen.b].forEach((team) =>
      team.forEach((p, i) =>
        team.slice(i + 1).forEach((q) => {
          mates[key(p, q)] = (mates[key(p, q)] || 0) + 1
        }),
      ),
    )
    chosen.a.forEach((p) =>
      chosen.b.forEach((q) => {
        opps[key(p, q)] = (opps[key(p, q)] || 0) + 1
      }),
    )
    ;[...chosen.a, ...chosen.b].forEach((id) => played[id]++)
    schedule.push(chosen)
  }
  const summary = ids
    .map((id) => {
      const teammates = new Set<string>()
      schedule.forEach((g) =>
        [g.a, g.b].forEach((team) => {
          if (team.includes(id)) team.forEach((t) => t !== id && teammates.add(t))
        }),
      )
      return { id, games: played[id], teammates: teammates.size }
    })
    .sort((x, y) => nameOf(x.id).localeCompare(nameOf(y.id)))
  return { games: schedule, summary, others: ids.length - 1 }
}
