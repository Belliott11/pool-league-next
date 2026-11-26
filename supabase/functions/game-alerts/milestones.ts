// Milestones and badges: career marks (points, 3s, assists, wins, games), win streaks and single-game firsts, each dated to the game that
// reached it. Shown on the Player page (src/components/Milestones.tsx) and sent with the "Final" game alert.
//
// This file must not import anything: the game-alerts edge function runs a byte-for-byte copy of it
// (supabase/functions/game-alerts/milestones.ts, checked by milestones.test.ts). Old results (the old site's list, which also holds this
// site's games up to its last date) give wins, games and streaks up to that date; this site's games give points, 3s and assists from
// every game, and results after the old list ends.

export interface MGame {
  id: string
  date: string
  teamA: string[]
  teamB: string[]
  winner?: string | null
  test?: boolean
  liveInProgress?: boolean
  stats?: { playerId: string; pts?: number; ast?: number }[]
  scoringEvents?: { scorerId: string; points: number; made?: boolean }[]
  liveScores?: { pid: string; points: number }[]
  scorekeeperScores?: { pid: string; points: number }[]
}

export interface OldResult {
  date: string
  a: string[]
  b: string[]
  w: string
}

export type MilestoneKind = "points" | "threes" | "assists" | "wins" | "games" | "streak" | "game"

export interface Milestone {
  pid: string
  kind: MilestoneKind
  value: number
  label: string
  date: string
  gameId: string | null // null when it came from an old result
}

const CAREER: { kind: MilestoneKind; steps: number[]; label: (n: number) => string; unit: (n: number) => string }[] = [
  { kind: "points", steps: [25, 50, 100, 200, 300, 500, 750, 1000], label: (n) => `${n} career points`, unit: (n) => (n === 1 ? "point" : "points") },
  { kind: "threes", steps: [1, 10, 25, 50, 100], label: (n) => (n === 1 ? "First 3" : `${n} career 3s`), unit: (n) => (n === 1 ? "3" : "3s") },
  { kind: "assists", steps: [10, 25, 50, 100, 200], label: (n) => `${n} career assists`, unit: (n) => (n === 1 ? "assist" : "assists") },
  { kind: "wins", steps: [10, 25, 50, 75, 100, 150, 200], label: (n) => `${n} career wins`, unit: (n) => (n === 1 ? "win" : "wins") },
  { kind: "games", steps: [25, 50, 100, 150, 200, 300], label: (n) => `${n} games played`, unit: (n) => (n === 1 ? "game" : "games") },
]
const STREAKS = [5, 8, 10, 15]
const GAME_POINTS = [10, 15]
const GAME_ASSISTS = [5]

export interface Totals {
  points: number
  threes: number
  assists: number
  wins: number
  games: number
  streak: number // current win streak
  bestStreak: number
}

export interface MilestoneBook {
  byPlayer: Map<string, Milestone[]>
  totals: Map<string, Totals>
}

function pointsIn(g: MGame, pid: string): number {
  if ((g.scoringEvents ?? []).length === 0) {
    const live = [...(g.liveScores ?? []), ...(g.scorekeeperScores ?? [])]
    if (live.length) return live.filter((s) => s.pid === pid).reduce((n, s) => n + s.points, 0)
  }
  return g.stats?.find((s) => s.playerId === pid)?.pts ?? 0
}
const assistsIn = (g: MGame, pid: string) => ((g.scoringEvents ?? []).length ? (g.stats?.find((s) => s.playerId === pid)?.ast ?? 0) : 0)
const threesIn = (g: MGame, pid: string) => (g.scoringEvents ?? []).filter((e) => e.scorerId === pid && e.points === 3 && e.made !== false).length

export function milestoneBook(games: MGame[], old: OldResult[]): MilestoneBook {
  const cutoff = old.reduce((d, r) => (r.date > d ? r.date : d), "")
  type Entry = { date: string; order: number; old?: OldResult; game?: MGame }
  const entries: Entry[] = [
    ...old.map((r, i) => ({ date: r.date, order: i, old: r })),
    ...games.filter((g) => !g.test && !g.liveInProgress).map((g, i) => ({ date: g.date || "", order: old.length + i, game: g })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
  const byPlayer = new Map<string, Milestone[]>()
  const totals = new Map<string, Totals>()
  const firsts = new Map<string, Set<string>>() // pid -> single-game and streak marks already reached
  const tot = (pid: string) => totals.get(pid) ?? totals.set(pid, { points: 0, threes: 0, assists: 0, wins: 0, games: 0, streak: 0, bestStreak: 0 }).get(pid)!
  const add = (m: Milestone) => (byPlayer.get(m.pid) ?? byPlayer.set(m.pid, []).get(m.pid)!).push(m)
  const bump = (pid: string, kind: MilestoneKind, by: number, date: string, gameId: string | null) => {
    if (!by) return
    const t = tot(pid)
    const before = t[kind as keyof Totals] as number
    const after = before + by
    ;(t as unknown as Record<string, number>)[kind] = after
    const c = CAREER.find((x) => x.kind === kind)!
    for (const s of c.steps) if (before < s && after >= s) add({ pid, kind, value: s, label: c.label(s), date, gameId })
  }
  const once = (pid: string, key: string, m: Omit<Milestone, "pid">) => {
    const seen = firsts.get(pid) ?? firsts.set(pid, new Set()).get(pid)!
    if (seen.has(key)) return
    seen.add(key)
    add({ pid, ...m })
  }
  const result = (pid: string, won: boolean, date: string, gameId: string | null) => {
    bump(pid, "games", 1, date, gameId)
    if (won) bump(pid, "wins", 1, date, gameId)
    const t = tot(pid)
    t.streak = won ? t.streak + 1 : 0
    t.bestStreak = Math.max(t.bestStreak, t.streak)
    for (const s of STREAKS) if (t.streak === s) once(pid, `streak${s}`, { kind: "streak", value: s, label: `${s}-game win streak`, date, gameId })
  }
  for (const e of entries) {
    if (e.old) {
      for (const pid of e.old.a) result(pid, e.old.w === "A", e.date, null)
      for (const pid of e.old.b) result(pid, e.old.w === "B", e.date, null)
      continue
    }
    const g = e.game!
    for (const pid of [...g.teamA, ...g.teamB]) {
      const pts = pointsIn(g, pid)
      const ast = assistsIn(g, pid)
      bump(pid, "points", pts, g.date, g.id)
      bump(pid, "threes", threesIn(g, pid), g.date, g.id)
      bump(pid, "assists", ast, g.date, g.id)
      for (const n of GAME_POINTS) if (pts >= n) once(pid, `pts${n}`, { kind: "game", value: n, label: `First ${n}-point game`, date: g.date, gameId: g.id })
      for (const n of GAME_ASSISTS) if (ast >= n) once(pid, `ast${n}`, { kind: "game", value: n, label: `First ${n}-assist game`, date: g.date, gameId: g.id })
      // Results up to the old list's last date are already in it.
      if (g.date > cutoff && (g.winner === "A" || g.winner === "B")) result(pid, (g.winner === "A") === g.teamA.includes(pid), g.date, g.id)
    }
  }
  return { byPlayer, totals }
}

// What a player reached in one game, for the "Final" alert.
export function reachedIn(book: MilestoneBook, gameId: string): Milestone[] {
  return [...book.byPlayer.values()].flat().filter((m) => m.gameId === gameId)
}

// The nearest career marks still ahead of a player, closest first (by share of the way left).
export function nextUp(book: MilestoneBook, pid: string, n = 3): { label: string; left: string; share: number }[] {
  const t = book.totals.get(pid)
  if (!t) return []
  const out: { label: string; left: string; share: number }[] = []
  for (const c of CAREER) {
    const have = t[c.kind as keyof Totals] as number
    const next = c.steps.find((s) => s > have)
    if (next === undefined) continue
    const left = next - have
    out.push({ label: c.label(next), left: `${left} ${c.unit(left)} to go`, share: left / next })
  }
  return out.sort((a, b) => a.share - b.share).slice(0, n)
}
