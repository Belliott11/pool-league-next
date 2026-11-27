import { describe } from "@/lib/filmRoom"
import { playValues, pointsAdded, type PlayValue } from "@/lib/epa"
import { currentForm } from "@/lib/form"
import { dramaRanking } from "@/lib/drama"
import type { Name } from "@/lib/playWords"
import type { PooleanState } from "@/lib/types"

// A player's last filmed night, graded against their own usual level only, never against anyone else (asked 2026-11-27, so a newer or
// weaker player is not marked down for being newer or weaker): their Points added per game that night (epa.ts) against their form rating
// going into it (form.ts), allowing for how much a night swings by chance. Also the play
// that helped their team most and the one to fix (both with video when they have it), their record and points, how their form rating
// (form.ts) moved, and whether they were in the game of the night (drama.ts). Shown on their page and in "Next up for you".

// The bar a night is graded against: their usual level, but a player below the league average (0) is asked for a small step toward it,
// STEP of the way, so playing exactly at a low usual earns a C+ rather than a B and a B means a little growth (asked 2026-11-27: grading
// only against their own level could reinforce staying the same). Above-average players keep their usual as the bar. Never anyone else's.
export const STEP = 0.25
export const barFor = (usual: number) => (usual < 0 ? usual + STEP * (0 - usual) : usual)

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
  date: string
  games: string[]
  wins: number
  losses: number
  points: number
  added: number // Points added per game that night
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

const filmed = (state: PooleanState) => state.games.filter((g) => g.scoringEvents.length > 0 && !g.liveInProgress && !g.test)

// Every player-night's Points added per game, for the grade's scale.
function nightValues(state: PooleanState): Map<string, number> {
  const per = new Map<string, { sum: number; n: number }>()
  for (const g of filmed(state))
    for (const r of pointsAdded(state, { only: g.id }).rows) {
      const k = `${r.id}|${g.date}`
      const v = per.get(k) ?? per.set(k, { sum: 0, n: 0 }).get(k)!
      v.sum += r.total
      v.n++
    }
  return new Map([...per].map(([k, v]) => [k, v.sum / v.n]))
}

export function nightReport(state: PooleanState, pid: string): NightReport | null {
  const mine = filmed(state).filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid))
  const date = mine.map((g) => g.date).sort().at(-1)
  if (!date) return null
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
  const beat = prior ? normalCdf((added - bar) / spread) : 0.5
  const nights = new Set(mine.map((g) => g.date)).size
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
  const night = dramaRanking(state).filter((d) => d.date === date)[0]
  const gameOfNight = night && tonight.some((g) => g.id === night.gameId) && dramaRanking(state).filter((d) => d.date === date).length > 1 ? night.gameId : null
  return { date, games: tonight.map((g) => g.id), wins, losses, points, added, usual: prior?.mean ?? null, bar: prior ? bar : null, beat, grade: prior ? gradeFor(beat) : null, nights, best, fix, formBefore: before, formAfter: after, gameOfNight }
}

export const playLine = (p: PlayValue, name: Name) => describe(p, name)

// The standard normal's cumulative chance (Abramowitz and Stegun 26.2.17, accurate to about 1e-7).
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2)
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return z > 0 ? 1 - p : p
}
