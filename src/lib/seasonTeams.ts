import { pointsAdded } from "@/lib/epa"
import { liveTargetOf } from "@/lib/live"
import { powerOf, predictTeamWinChances, UNKNOWN_PLAYER_PCT } from "@/lib/matchup"
import { winChanceWith } from "@/lib/winsAdded"
import type { Game, PooleanState, SeasonTeam, SeasonTeamSet } from "@/lib/types"

// Season teams: teams that exist only in the stats. Game nights stay pickup, so season teammates play with and against each other, and
// every player's own results feed their season team. A member scores, each night they play, their game wins (a rivalry game, where the
// two pickup teams are two whole season teams, counts double) plus their Wins added (winsAdded.ts: Points added turned into wins, filmed
// games only). A team's score is the average over its members' nights, so a team is not ahead just because its members came more often.

export const RIVALRY_WEIGHT = 2
export const THIN_NIGHTS = 4 // member-nights before a team's score is more than an early read
export const COLORS = ["#2f7de1", "#e2552b", "#1f9d6b", "#a35bd6", "#d9a400", "#d6336c"]

export const currentSet = (state: PooleanState): SeasonTeamSet | null => {
  const sets = state.seasonTeamSets ?? []
  const open = [...sets].reverse().find((s) => !s.to)
  return open ?? null
}

export const teamOf = (set: SeasonTeamSet | null, pid: string): SeasonTeam | null => set?.teams.find((t) => t.members.includes(pid)) ?? null

const decided = (g: Game) => !g.liveInProgress && !g.test && (g.winner === "A" || g.winner === "B")
export const gamesIn = (state: PooleanState, set: SeasonTeamSet): Game[] =>
  state.games.filter((g) => decided(g) && (g.date || "") >= set.from && (!set.to || (g.date || "") < set.to)).sort((a, b) => (a.date || "").localeCompare(b.date || ""))

// A rivalry game: each pickup team is made of members of one season team, and the two season teams differ.
export function rivalryOf(set: SeasonTeamSet, g: Game): { a: SeasonTeam; b: SeasonTeam } | null {
  const whole = (side: string[]) => {
    const t = side.length ? teamOf(set, side[0]) : null
    return t && side.every((p) => t.members.includes(p)) ? t : null
  }
  const a = whole(g.teamA)
  const b = whole(g.teamB)
  return a && b && a.id !== b.id ? { a, b } : null
}

// Each player's Wins added in one filmed game, at the league's rates.
function gameWins(state: PooleanState, g: Game): Map<string, number> {
  const out = new Map<string, number>()
  if (!g.scoringEvents.length) return out
  const target = liveTargetOf(g)
  for (const r of pointsAdded(state, { only: g.id }).rows) out.set(r.id, (winChanceWith(r.perGame, target) - 0.5) * r.gamesWorth)
  return out
}

export interface MemberLine {
  id: string
  nights: number
  wins: number // game wins, rivalry games counted double
  winsAdded: number
  score: number // (wins + winsAdded) per night
}

export interface TeamLine {
  team: SeasonTeam
  memberNights: number
  wins: number
  winsAdded: number
  score: number
  rivalry: [number, number] // rivalry games won and lost
  members: MemberLine[]
}

export interface Standings {
  set: SeasonTeamSet
  games: number
  rows: TeamLine[] // best first
  nights: { date: string; best: SeasonTeam | null; score: number }[] // each night's team of the night
  rivalries: { game: Game; a: SeasonTeam; b: SeasonTeam; winner: SeasonTeam }[]
}

export function standings(state: PooleanState, set: SeasonTeamSet): Standings {
  const games = gamesIn(state, set)
  // member -> date -> { wins, winsAdded }
  const by = new Map<string, Map<string, { wins: number; winsAdded: number }>>()
  const cell = (pid: string, date: string) => {
    const m = by.get(pid) ?? by.set(pid, new Map()).get(pid)!
    return m.get(date) ?? m.set(date, { wins: 0, winsAdded: 0 }).get(date)!
  }
  const rivalries: Standings["rivalries"] = []
  for (const g of games) {
    const rv = rivalryOf(set, g)
    const weight = rv ? RIVALRY_WEIGHT : 1
    const wa = gameWins(state, g)
    if (rv) rivalries.push({ game: g, a: rv.a, b: rv.b, winner: g.winner === "A" ? rv.a : rv.b })
    for (const [side, ids] of [["A", g.teamA], ["B", g.teamB]] as const)
      for (const pid of ids) {
        if (!teamOf(set, pid)) continue
        const c = cell(pid, g.date)
        if (g.winner === side) c.wins += weight
        c.winsAdded += wa.get(pid) ?? 0
      }
  }
  const rows: TeamLine[] = set.teams.map((team) => {
    const members: MemberLine[] = team.members.map((id) => {
      const nights = [...(by.get(id)?.values() ?? [])]
      const wins = nights.reduce((n, c) => n + c.wins, 0)
      const winsAdded = nights.reduce((n, c) => n + c.winsAdded, 0)
      return { id, nights: nights.length, wins, winsAdded, score: nights.length ? (wins + winsAdded) / nights.length : 0 }
    })
    const memberNights = members.reduce((n, m) => n + m.nights, 0)
    const wins = members.reduce((n, m) => n + m.wins, 0)
    const winsAdded = members.reduce((n, m) => n + m.winsAdded, 0)
    const rivalry: [number, number] = [0, 0]
    for (const r of rivalries) if (r.a.id === team.id || r.b.id === team.id) rivalry[r.winner.id === team.id ? 0 : 1]++
    return { team, memberNights, wins, winsAdded, score: memberNights ? (wins + winsAdded) / memberNights : 0, rivalry, members: members.sort((x, y) => y.score - x.score) }
  })
  rows.sort((x, y) => y.score - x.score || y.wins + y.winsAdded - (x.wins + x.winsAdded))
  // Team of the night: the best average among the teams with someone playing that night.
  const dates = [...new Set(games.map((g) => g.date))]
  const nights = dates.map((date) => {
    let best: SeasonTeam | null = null
    let bestScore = -Infinity
    for (const team of set.teams) {
      const cells = team.members.map((id) => by.get(id)?.get(date)).filter((c): c is { wins: number; winsAdded: number } => !!c)
      if (!cells.length) continue
      const avg = cells.reduce((n, c) => n + c.wins + c.winsAdded, 0) / cells.length
      if (avg > bestScore) (best = team), (bestScore = avg)
    }
    return { date, best, score: best ? bestScore : 0 }
  })
  return { set, games: games.length, rows, nights, rivalries }
}

// The finished sets' champions, newest first, for the Hall of Fame.
export function champions(state: PooleanState): { set: SeasonTeamSet; line: TeamLine }[] {
  return (state.seasonTeamSets ?? [])
    .filter((s) => s.to && !s.drafting)
    .map((set) => ({ set, line: standings(state, set).rows[0] }))
    .filter((c) => c.line && c.line.memberNights > 0)
    .reverse()
}

// ---------- the draft ----------

// Whose pick it is in a snake draft: round one in order, round two reversed, and so on. Captains are already on their teams.
export function onTheClock(set: SeasonTeamSet): SeasonTeam | null {
  const n = set.teams.length
  if (!n) return null
  const picked = set.teams.reduce((k, t) => k + t.members.filter((m) => m !== t.captain).length, 0)
  const round = Math.floor(picked / n)
  const slot = picked % n
  return set.teams[round % 2 === 0 ? slot : n - 1 - slot]
}

export function draftPick(set: SeasonTeamSet, pid: string): SeasonTeamSet {
  const t = onTheClock(set)
  if (!t || set.teams.some((x) => x.members.includes(pid))) return set
  return { ...set, teams: set.teams.map((x) => (x.id === t.id ? { ...x, members: [...x.members, pid] } : x)) }
}

// Takes back the last pick (never a captain).
export function undoPick(set: SeasonTeamSet): SeasonTeamSet {
  const n = set.teams.length
  const picked = set.teams.reduce((k, t) => k + t.members.filter((m) => m !== t.captain).length, 0)
  if (!picked) return set
  const last = picked - 1
  const round = Math.floor(last / n)
  const slot = last % n
  const t = set.teams[round % 2 === 0 ? slot : n - 1 - slot]
  return { ...set, teams: set.teams.map((x) => (x.id === t.id ? { ...x, members: x.members.slice(0, -1) } : x)) }
}

// The first round's order: the weakest captain (by power ranking) picks first, so with the snake the strongest captain picks last in
// round one and first in round two. A captain is a free first pick, and this evens out most of the head start. Ties go by name order.
export function captainOrder<T extends { captain: string | null }>(teams: T[], nameOf: (id: string) => string = (id) => id): T[] {
  const power = (t: T) => (t.captain ? (powerOf(t.captain) ?? UNKNOWN_PLAYER_PCT) : UNKNOWN_PLAYER_PCT)
  return [...teams].sort((a, b) => power(a) - power(b) || nameOf(a.captain ?? "").localeCompare(nameOf(b.captain ?? "")))
}

// Each team's chance of beating the others if the season teams played each other, from the pre-game model (matchup.ts): a quick read
// on whether the draft is coming out even. null before the model has enough games.
export function teamStrength(set: SeasonTeamSet): Map<string, number> | null {
  const teams = set.teams.filter((t) => t.members.length)
  if (teams.length < 2) return null
  const p = predictTeamWinChances(teams.map((t) => t.members))
  return p ? new Map(teams.map((t, i) => [t.id, p[i]])) : null
}

export function newSet(from: string, teams: { name: string; captain: string | null }[]): SeasonTeamSet {
  return {
    id: `st_${Date.now().toString(36)}`,
    from,
    drafting: true,
    teams: teams.map((t, i) => ({ id: `t${i + 1}_${Date.now().toString(36)}`, name: t.name.trim() || `Team ${i + 1}`, color: COLORS[i % COLORS.length], captain: t.captain, members: t.captain ? [t.captain] : [] })),
  }
}

// Saves a set in the league data: replaces the one with the same id, or adds it.
export function putSet(state: PooleanState, set: SeasonTeamSet): PooleanState {
  const sets = state.seasonTeamSets ?? []
  return { ...state, seasonTeamSets: sets.some((s) => s.id === set.id) ? sets.map((s) => (s.id === set.id ? set : s)) : [...sets, set] }
}
