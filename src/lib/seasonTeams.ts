import { pointsAdded } from "@/lib/epa"
import { liveTargetOf } from "@/lib/live"
import { powerOf, predictTeamWinChances, UNKNOWN_PLAYER_PCT } from "@/lib/matchup"
import { winChanceWith } from "@/lib/winsAdded"
import type { Game, PooleanState, SeasonTeam, SeasonTeamSet } from "@/lib/types"

// Season teams: teams that exist only in the stats. Game nights stay pickup, so season teammates play with and against each other, and
// every player's own results feed their season team. A player's night is their game wins (a rivalry game, where the two pickup teams are
// two whole season teams, counts double) plus their Wins added (winsAdded.ts: Points added turned into wins, filmed games only), per
// game played that night, so a long night is worth no more than a short one. Each
// night, every team counts the average of its best few players' nights, the same number for every team: the fewest any team had there,
// but at least 2 (a team with fewer there gets a bench night for each empty spot). So roster size and turnout do not decide it, a weak night never hurts,
// and extra players are depth. Every night counts for every team: a team with nobody there gets a bench night for each spot. A team's
// score is the average of its nights. Nights count for the team a player was on that night, so a
// trade or a newcomer only changes things from the day it happens.
export const RIVALRY_WEIGHT = 2
export const THIN_NIGHTS = 2 // team nights before a team's score is more than an early read
export const MIN_COUNTED = 2 // each team counts at least this many players' nights
export const BENCH_PCT = 0.25 // an empty spot counts as a bench night: this far up all the set's player-nights

// The value of the night at fraction q of the sorted list (linear between neighbours), 0 when there are none.
function quantile(values: number[], q: number): number {
  if (!values.length) return 0
  const v = [...values].sort((a, b) => a - b)
  const at = (v.length - 1) * q
  const lo = Math.floor(at)
  return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (at - lo)
}
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

// The team a player was on, on a date: their last move on or before it, else the team they left on their first later move, else their
// current team.
export function teamOn(set: SeasonTeamSet, pid: string, date: string): SeasonTeam | null {
  const moves = (set.moves ?? []).filter((m) => m.pid === pid).sort((a, b) => a.date.localeCompare(b.date))
  if (!moves.length) return teamOf(set, pid)
  const before = moves.filter((m) => m.date <= date).at(-1)
  const id = before ? before.to : moves[0].from
  return id ? (set.teams.find((t) => t.id === id) ?? null) : null
}

// A rivalry game: each pickup team is made of members of one season team (on that date), and the two season teams differ.
export function rivalryOf(set: SeasonTeamSet, g: Game): { a: SeasonTeam; b: SeasonTeam } | null {
  const whole = (side: string[]) => {
    const t = side.length ? teamOn(set, side[0], g.date || "") : null
    return t && side.every((p) => teamOn(set, p, g.date || "")?.id === t.id) ? t : null
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
  nights: number // nights they played for this team
  counted: number // of those, nights that were among the team's best that night
  games: number
  wins: number // game wins, rivalry games counted double
  winsAdded: number
  score: number // the average of their nights, each night (wins + winsAdded) per game
  current: boolean // still on the team
}

export interface TeamLine {
  team: SeasonTeam
  nights: number // nights the team had someone there
  allNights: number // every night in the set: the score averages over all of them
  wins: number
  winsAdded: number
  score: number // the average of its nightly scores
  rivalry: [number, number] // rivalry games won and lost
  members: MemberLine[]
}

export interface NightLine {
  date: string
  counted: number // how many players' nights each team counted
  scores: { team: SeasonTeam; score: number; present: number; filled: number }[] // best first; filled: empty spots given a bench night
}

export interface Standings {
  set: SeasonTeamSet
  games: number
  rows: TeamLine[] // best first
  nights: NightLine[]
  rivalries: { game: Game; a: SeasonTeam; b: SeasonTeam; winner: SeasonTeam }[]
  bench: number // what an empty spot is worth
}

export function standings(state: PooleanState, set: SeasonTeamSet): Standings {
  const games = gamesIn(state, set)
  // date -> player -> their night, with the team they played for that night
  const by = new Map<string, Map<string, { team: string; games: number; wins: number; winsAdded: number }>>()
  const rivalries: Standings["rivalries"] = []
  for (const g of games) {
    const rv = rivalryOf(set, g)
    const weight = rv ? RIVALRY_WEIGHT : 1
    const wa = gameWins(state, g)
    if (rv) rivalries.push({ game: g, a: rv.a, b: rv.b, winner: g.winner === "A" ? rv.a : rv.b })
    for (const [side, ids] of [["A", g.teamA], ["B", g.teamB]] as const)
      for (const pid of ids) {
        const team = teamOn(set, pid, g.date || "")
        if (!team) continue
        const night = by.get(g.date) ?? by.set(g.date, new Map()).get(g.date)!
        const c = night.get(pid) ?? night.set(pid, { team: team.id, games: 0, wins: 0, winsAdded: 0 }).get(pid)!
        c.games++
        if (g.winner === side) c.wins += weight
        c.winsAdded += wa.get(pid) ?? 0
      }
  }
  const member = new Map<string, MemberLine>() // key team|pid
  const line = (team: string, pid: string) =>
    member.get(`${team}|${pid}`) ??
    member.set(`${team}|${pid}`, { id: pid, nights: 0, counted: 0, games: 0, wins: 0, winsAdded: 0, score: 0, current: !!set.teams.find((t) => t.id === team)?.members.includes(pid) }).get(`${team}|${pid}`)!
  // A player's night is per game, so a long night is worth no more than a short one, and leaving early costs nothing but the games.
  const perGame = (c: { games: number; wins: number; winsAdded: number }) => (c.wins + c.winsAdded) / c.games
  // A team with fewer players there than the night counts fills each empty spot with a bench night (the bottom quarter of every
  // player-night in the set), so one player cannot stand in for a full team, and a below-average player gains nothing by staying home.
  const bench = quantile([...by.values()].flatMap((night) => [...night.values()].map(perGame)), BENCH_PCT)
  const teamNights = new Map<string, number[]>()
  const nights: NightLine[] = []
  for (const [date, night] of [...by].sort((a, b) => a[0].localeCompare(b[0]))) {
    const perTeam = new Map<string, { pid: string; v: number }[]>()
    for (const [pid, c] of night) {
      const m = line(c.team, pid)
      m.nights++
      m.games += c.games
      m.wins += c.wins
      m.winsAdded += c.winsAdded
      m.score += perGame(c) // summed here, averaged below
      ;(perTeam.get(c.team) ?? perTeam.set(c.team, []).get(c.team)!).push({ pid, v: perGame(c) })
    }
    const fewest = Math.min(...[...perTeam.values()].map((l) => l.length))
    const k = Math.max(MIN_COUNTED, fewest)
    const scores: NightLine["scores"] = []
    for (const [teamId, list] of perTeam) {
      const best = [...list].sort((a, b) => b.v - a.v).slice(0, Math.min(k, list.length))
      for (const b of best) line(teamId, b.pid).counted++
      const filled = k - best.length
      const score = (best.reduce((n, b) => n + b.v, 0) + filled * bench) / k
      ;(teamNights.get(teamId) ?? teamNights.set(teamId, []).get(teamId)!).push(score)
      const team = set.teams.find((t) => t.id === teamId)
      if (team) scores.push({ team, score, present: list.length, filled })
    }
    // A team with nobody there gets a bench night for every spot, so showing up is never worse than staying home (unless the player
    // would score in the bottom quarter), and a team cannot protect its average by skipping a night.
    for (const team of set.teams)
      if (!perTeam.has(team.id)) {
        ;(teamNights.get(team.id) ?? teamNights.set(team.id, []).get(team.id)!).push(bench)
        scores.push({ team, score: bench, present: 0, filled: k })
      }
    nights.push({ date, counted: k, scores: scores.sort((a, b) => b.score - a.score) })
  }
  for (const m of member.values()) m.score = m.nights ? m.score / m.nights : 0
  const rows: TeamLine[] = set.teams.map((team) => {
    const members = [...member.entries()].filter(([k]) => k.startsWith(`${team.id}|`)).map(([, m]) => m)
    for (const pid of team.members) if (!members.some((m) => m.id === pid)) members.push({ id: pid, nights: 0, counted: 0, games: 0, wins: 0, winsAdded: 0, score: 0, current: true })
    const list = teamNights.get(team.id) ?? []
    const there = nights.filter((n) => n.scores.some((x) => x.team.id === team.id && x.present > 0)).length
    const rivalry: [number, number] = [0, 0]
    for (const r of rivalries) if (r.a.id === team.id || r.b.id === team.id) rivalry[r.winner.id === team.id ? 0 : 1]++
    return {
      team,
      nights: there,
      allNights: list.length,
      wins: members.reduce((n, m) => n + m.wins, 0),
      winsAdded: members.reduce((n, m) => n + m.winsAdded, 0),
      score: list.length ? list.reduce((n, v) => n + v, 0) / list.length : 0,
      rivalry,
      members: members.sort((x, y) => Number(y.current) - Number(x.current) || y.score - x.score),
    }
  })
  rows.sort((x, y) => y.score - x.score || y.wins + y.winsAdded - (x.wins + x.winsAdded))
  return { set, games: games.length, rows, nights, rivalries, bench }
}

// ---------- trades and newcomers ----------

// Puts a player on a team from a date (a trade, or a newcomer when they were on no team), keeping the move so earlier nights stay with
// the team they were played for. `to` null takes them off every team.
export function movePlayer(set: SeasonTeamSet, pid: string, to: string | null, date: string): SeasonTeamSet {
  const from = teamOf(set, pid)?.id ?? null
  if (from === to) return set
  return {
    ...set,
    teams: set.teams.map((t) => ({ ...t, members: t.id === to ? [...t.members.filter((m) => m !== pid), pid] : t.members.filter((m) => m !== pid) })),
    moves: [...(set.moves ?? []), { pid, from, to, date }],
  }
}

// Takes back the most recent move: the player goes back where they came from (or off the teams, for a newcomer).
export function undoMove(set: SeasonTeamSet): SeasonTeamSet {
  const moves = set.moves ?? []
  const last = moves.at(-1)
  if (!last) return set
  return {
    ...set,
    teams: set.teams.map((t) => ({
      ...t,
      members: t.id === last.from ? [...t.members.filter((m) => m !== last.pid), last.pid] : t.members.filter((m) => m !== last.pid),
    })),
    moves: moves.slice(0, -1),
  }
}

// Where the next newcomer goes: the team lowest in the standings (a team that has not played yet counts as lowest), ties to the team with
// fewer players. Under best-nights scoring an extra player only adds depth, so this is a light catch-up for the trailing team.
export function nextNewcomerTeam(state: PooleanState, set: SeasonTeamSet): SeasonTeam | null {
  const s = standings(state, set)
  const order = [...s.rows].sort((a, b) => a.score - b.score || a.team.members.length - b.team.members.length)
  return order[0]?.team ?? null
}

// The finished sets' champions, newest first, for the Hall of Fame.
// A finished set's champion: the finals winner when finals were played to the end, else the top of the standings.
export function champions(state: PooleanState): { set: SeasonTeamSet; line: TeamLine; finals: boolean }[] {
  return (state.seasonTeamSets ?? [])
    .filter((s) => s.to && !s.drafting)
    .map((set) => {
      const rows = standings(state, set).rows
      const won = set.finals ? finals(state, set).champion : null
      return { set, line: (won && rows.find((r) => r.team.id === won.id)) || rows[0], finals: !!won }
    })
    .filter((c) => c.line && c.line.nights > 0)
    .reverse()
}

// ---------- finals night ----------

// A playoff at the end of the season, played as rivalry games (each pickup team is one whole season team). With four or more teams the
// top four go in: semifinals 1 against 4 and 2 against 3, one game each, then a final, first to two wins. With two or three teams the top
// two play the final. Seeds are frozen when the editor starts finals night (`startFinals`), so later nights do not reshuffle the bracket.
// Rivalry games from that date count: a game between two teams in an open series goes to that series, in the order they were played.

export interface Series {
  round: "semi" | "final"
  a: SeasonTeam | null // the higher seed, or null while the semifinal deciding it is open
  b: SeasonTeam | null
  seedA: number | null
  seedB: number | null
  need: number // wins to take it
  wins: [number, number]
  games: Game[]
  winner: SeasonTeam | null
}

export interface Finals {
  semis: Series[]
  final: Series
  champion: SeasonTeam | null
}

export const SEMI_WINS = 1
export const FINAL_WINS = 2

// Starts finals night from today's standings (top four, or top two with fewer than four teams).
export function startFinals(state: PooleanState, set: SeasonTeamSet, from: string): SeasonTeamSet {
  const rows = standings(state, set).rows
  const n = set.teams.length >= 4 ? 4 : 2
  return { ...set, finals: { from, seeds: rows.slice(0, n).map((r) => r.team.id) } }
}

export function finals(state: PooleanState, set: SeasonTeamSet): Finals {
  const seeds = (set.finals?.seeds ?? []).map((id) => set.teams.find((t) => t.id === id) ?? null)
  const series = (round: Series["round"], a: SeasonTeam | null, b: SeasonTeam | null, need: number): Series => ({
    round,
    a,
    b,
    seedA: a ? seeds.indexOf(a) + 1 : null,
    seedB: b ? seeds.indexOf(b) + 1 : null,
    need,
    wins: [0, 0],
    games: [],
    winner: null,
  })
  const semis = seeds.length >= 4 ? [series("semi", seeds[0], seeds[3], SEMI_WINS), series("semi", seeds[1], seeds[2], SEMI_WINS)] : []
  const final = series("final", seeds.length >= 4 ? null : seeds[0], seeds.length >= 4 ? null : seeds[1], FINAL_WINS)
  const from = set.finals?.from
  const games = from ? gamesIn(state, set).filter((g) => (g.date || "") >= from) : []
  const settle = (s: Series) => {
    if (s.wins[0] >= s.need) s.winner = s.a
    else if (s.wins[1] >= s.need) s.winner = s.b
  }
  for (const g of games) {
    const rv = rivalryOf(set, g)
    if (!rv) continue
    const winner = g.winner === "A" ? rv.a : g.winner === "B" ? rv.b : null
    if (!winner) continue
    // The final's teams are set once both semifinals are decided.
    if (semis.length && !final.a && semis.every((x) => x.winner)) {
      const [w1, w2] = semis.map((x) => x.winner!)
      const [hi, lo] = seeds.indexOf(w1) < seeds.indexOf(w2) ? [w1, w2] : [w2, w1]
      Object.assign(final, { a: hi, b: lo, seedA: seeds.indexOf(hi) + 1, seedB: seeds.indexOf(lo) + 1 })
    }
    const open = [...semis, final].find((s) => !s.winner && s.a && s.b && [s.a.id, s.b.id].sort().join() === [rv.a.id, rv.b.id].sort().join())
    if (!open) continue
    open.games.push(g)
    open.wins[winner.id === open.a!.id ? 0 : 1]++
    settle(open)
  }
  if (semis.length && !final.a && semis.every((x) => x.winner)) {
    const [w1, w2] = semis.map((x) => x.winner!)
    const [hi, lo] = seeds.indexOf(w1) < seeds.indexOf(w2) ? [w1, w2] : [w2, w1]
    Object.assign(final, { a: hi, b: lo, seedA: seeds.indexOf(hi) + 1, seedB: seeds.indexOf(lo) + 1 })
  }
  return { semis, final, champion: final.winner }
}

// ---------- the draft ----------

// Whose pick it is in a snake draft: round one in order, round two reversed, and so on. Captains are already on their teams.
// The snake draft itself lives in seasonDraft.ts, shared with the season-draft edge function.
export { draftPick, onTheClock, picksMade, undoPick } from "@/lib/seasonDraft"

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
