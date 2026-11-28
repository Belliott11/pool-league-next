import { describe } from "@/lib/filmRoom"
import { playValues, pointsAdded, type PlayValue } from "@/lib/epa"
import { currentForm } from "@/lib/form"
import { dramaRanking } from "@/lib/drama"
import type { Name } from "@/lib/playWords"
import { playerLine } from "@/lib/nightRecap"
import type { PooleanState } from "@/lib/types"
import { filmedGames } from "@/lib/filmed"

// A player's last filmed night, graded against their own usual level only, never against anyone else (asked 2026-11-27, so a newer or
// weaker player is not marked down for being newer or weaker): half their Points added per game that night (epa.ts) against their form
// rating going into it (form.ts), half their Two-Way against their own Two-Way going in, allowing for how much a night swings by chance. Also the play
// that helped their team most and the one to fix (both with video when they have it), their record and points, how their form rating
// (form.ts) moved, and whether they were in the game of the night (drama.ts). Shown on their page and in "Next up for you".

// The bar a night is graded against: their usual level, but a player below the league average (0) is asked for a small step toward it,
// STEP of the way, so playing exactly at a low usual earns a C+ rather than a B and a B means a little growth (asked 2026-11-27: grading
// only against their own level could reinforce staying the same). Above-average players keep their usual as the bar. Never anyone else's.
export const STEP = 0.25
export const barFor = (usual: number, league = 0) => (usual < league ? usual + STEP * (league - usual) : usual)

// The grade is half Points added and half Two-Way (asked 2026-11-28): each side is how far the night sat above or below its bar in that
// stat's own night-to-night swing, and the two are averaged and rescaled by how closely they move together (RHO), so an A is as rare as
// before. Two-Way's usual level is the player's own games before the night leaned on the league average by TWO_PRIOR games, like the form
// rating's start (form.ts PRIOR_GAMES).
export const TWO_PRIOR = 8

// Grades by how unusual the night was for them: the share of their own nights it would beat, from how far it sat from their usual level
// in the night-to-night spread. No F: it is a friends' league.
export const GRADES: [number, string][] = [
  [0.9, "A+"],
  [0.75, "A"],
  [0.6, "B+"],
  [0.45, "B"],
  [0.3, "C+"],
  [0.15, "C"],
  [0, "D"],
]
export const gradeFor = (beat: number) => GRADES.find(([at]) => beat >= at)![1]

export interface NightReport {
  pid: string
  date: string
  games: string[]
  wins: number
  losses: number
  points: number
  added: number // Points added per game that night
  twoWay: number | null // Two-Way per game that night
  twoUsual: number | null // their Two-Way a game going in
  twoBar: number | null
  usual: number | null // their form rating going into the night; null on their first filmed night (no grade then)
  bar: number | null // what a B asks of them: their usual, nudged toward the league average when they are below it
  beat: number // the share of their own nights this one would beat (0 to 1)
  grade: string | null
  nights: number // their filmed nights so far
  best: PlayValue | null
  fix: PlayValue | null
  formBefore: number | null
  formAfter: number | null
  gameOfNight: string | null // the night's most dramatic game, when they played in it
}

// Every player-night's Points added per game, for the grade's scale.
function nightValues(state: PooleanState): Map<string, number> {
  const per = new Map<string, { sum: number; n: number }>()
  for (const g of filmedGames(state))
    for (const r of pointsAdded(state, { only: g.id }).rows) {
      const k = `${r.id}|${g.date}`
      const v = per.get(k) ?? per.set(k, { sum: 0, n: 0 }).get(k)!
      v.sum += r.total
      v.n++
    }
  return new Map([...per].map(([k, v]) => [k, v.sum / v.n]))
}

// Every player's Two-Way in each filmed game, the league's average, how much a game swings around a player's own level (pooled), and how
// closely a game's Two-Way and Points added move together. Kept per copy of the league data.
type TwoWayModel = { lines: Map<string, { date: string; v: number }[]>; league: number; noise: number; rho: number }
const twoCache = new WeakMap<PooleanState, TwoWayModel>()
function twoWayModel(state: PooleanState): TwoWayModel {
  const kept = twoCache.get(state)
  if (kept) return kept
  const lines = new Map<string, { date: string; v: number }[]>()
  const pairs: [number, number][] = []
  for (const g of filmedGames(state)) {
    const pa = new Map(pointsAdded(state, { only: g.id }).rows.map((r) => [r.id, r.total]))
    for (const id of [...g.teamA, ...g.teamB]) {
      const v = playerLine(g, id).twoWay
      if (v === null) continue
      ;(lines.get(id) ?? lines.set(id, []).get(id)!).push({ date: g.date, v })
      pairs.push([v, pa.get(id) ?? 0])
    }
  }
  const all = [...lines.values()].flat().map((x) => x.v)
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0)
  const league = mean(all)
  let ss = 0, n = 0
  for (const v of lines.values()) {
    const m = mean(v.map((x) => x.v))
    for (const x of v) (ss += (x.v - m) ** 2), n++
  }
  const noise = n > lines.size ? Math.sqrt(ss / (n - lines.size)) : 5
  const mx = mean(pairs.map((p) => p[0])), my = mean(pairs.map((p) => p[1]))
  const cov = mean(pairs.map((p) => (p[0] - mx) * (p[1] - my)))
  const sx = Math.sqrt(mean(pairs.map((p) => (p[0] - mx) ** 2))), sy = Math.sqrt(mean(pairs.map((p) => (p[1] - my) ** 2)))
  const rho = sx > 0 && sy > 0 ? Math.max(0, Math.min(0.95, cov / (sx * sy))) : 0
  const model = { lines, league, noise, rho }
  twoCache.set(state, model)
  return model
}

// The filmed nights a player played, newest first.
export function nightsOf(state: PooleanState, pid: string): string[] {
  return [...new Set(filmedGames(state).filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid)).map((g) => g.date))].sort().reverse()
}

// Every player's report for one filmed night (the night recap's "Night grades"), best grade first, first nights (no grade) last.
export function nightGrades(state: PooleanState, date: string): NightReport[] {
  const ids = [...new Set(filmedGames(state).filter((g) => g.date === date).flatMap((g) => [...g.teamA, ...g.teamB]))]
  return ids
    .map((id) => ({ id, r: nightReport(state, id, date) }))
    .filter((x): x is { id: string; r: NightReport } => !!x.r)
    .sort((a, b) => (b.r.grade ? b.r.beat : -1) - (a.r.grade ? a.r.beat : -1))
    .map((x) => x.r)
}

// A player's night, graded: their last filmed night, or the one named.
export function nightReport(state: PooleanState, pid: string, on?: string): NightReport | null {
  const mine = filmedGames(state).filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid))
  const date = on ?? mine.map((g) => g.date).sort().at(-1)
  if (!date || !mine.some((g) => g.date === date)) return null
  const tonight = mine.filter((g) => g.date === date)
  const values = nightValues(state)
  const added = values.get(`${pid}|${date}`) ?? 0
  const form = currentForm(state)
  const row = form.rows.find((r) => r.id === pid)
  const prior = row?.history.filter((h) => h.date < date).at(-1) ?? null
  // How much one game's Points added swings by chance (the parts' noise together), shrunk for a night of several games, plus how unsure
  // their usual level still is.
  const gameNoise = Math.sqrt(Object.values(form.noise).reduce((a, n) => a + n * n, 0))
  const spread = prior ? Math.sqrt((gameNoise * gameNoise) / tonight.length + prior.sd * prior.sd) : 1
  const bar = prior ? barFor(prior.mean) : 0
  // The Two-Way side: tonight's Two-Way a game against their own level going in, in the same way.
  const tw = twoWayModel(state)
  const mineTw = tw.lines.get(pid) ?? []
  const tonightTw = mineTw.filter((x) => x.date === date).map((x) => x.v)
  const beforeTw = mineTw.filter((x) => x.date < date).map((x) => x.v)
  const twoWay = tonightTw.length ? tonightTw.reduce((a, x) => a + x, 0) / tonightTw.length : null
  const twoUsual = beforeTw.length ? (beforeTw.reduce((a, x) => a + x, 0) + TWO_PRIOR * tw.league) / (beforeTw.length + TWO_PRIOR) : null
  const twoBar = twoUsual === null ? null : barFor(twoUsual, tw.league)
  const zPa = prior ? (added - bar) / spread : 0
  const zTw = twoWay !== null && twoBar !== null ? (twoWay - twoBar) / Math.sqrt((tw.noise * tw.noise) / tonightTw.length + (tw.noise * tw.noise) / (beforeTw.length + TWO_PRIOR)) : null
  // Two scores that move together are averaged and rescaled so the blend swings as much as one score does.
  const z = zTw === null ? zPa : (zPa + zTw) / Math.sqrt(2 + 2 * tw.rho)
  const beat = prior ? normalCdf(z) : 0.5
  const nights = new Set(mine.filter((g) => g.date <= date).map((g) => g.date)).size
  let wins = 0
  let losses = 0
  let points = 0
  for (const g of tonight) {
    const side = g.teamA.includes(pid) ? "A" : "B"
    const pts = (team: string[]) => g.scoringEvents.filter((e) => e.made !== false && team.includes(e.scorerId)).reduce((a, e) => a + e.points, 0)
    const a = pts(g.teamA)
    const b = pts(g.teamB)
    if ((side === "A" && a > b) || (side === "B" && b > a)) wins++
    else if (a !== b) losses++
    points += g.scoringEvents.filter((e) => e.made !== false && e.scorerId === pid).reduce((s, e) => s + e.points, 0)
  }
  // Their plays that night with video: the best as shooter or passer, the one to fix as shooter or who lost the ball.
  const plays = playValues(state, tonight.map((g) => g.id)).filter((p) => p.t !== null)
  const best = plays.filter((p) => (p.player === pid || p.passer === pid) && p.value > 0).sort((x, y) => y.value - x.value)[0] ?? null
  const fix = plays.filter((p) => p.player === pid && p.value < 0).sort((x, y) => x.value - y.value)[0] ?? null
  // The form rating just before this night and after it.
  const before = prior?.mean ?? (row ? 0 : null)
  const after = row?.history.filter((h) => h.date <= date).at(-1)?.mean ?? null
  const ofNight = dramaRanking(state, date)
  const gameOfNight = ofNight.length > 1 && tonight.some((g) => g.id === ofNight[0].gameId) ? ofNight[0].gameId : null
  return { pid, date, games: tonight.map((g) => g.id), wins, losses, points, added, twoWay, twoUsual, twoBar, usual: prior?.mean ?? null, bar: prior ? bar : null, beat, grade: prior ? gradeFor(beat) : null, nights, best, fix, formBefore: before, formAfter: after, gameOfNight }
}

export const playLine = (p: PlayValue, name: Name) => describe(p, name)

// The standard normal's cumulative chance (Abramowitz and Stegun 26.2.17, accurate to about 1e-7).
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z > 0 ? 1 - p : p
}
