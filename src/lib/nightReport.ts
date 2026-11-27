import { describe } from "@/lib/filmRoom"
import { playValues, pointsAdded, type PlayValue } from "@/lib/epa"
import { currentForm } from "@/lib/form"
import { dramaRanking } from "@/lib/drama"
import type { Name } from "@/lib/playWords"
import type { PooleanState } from "@/lib/types"

// A player's last filmed night, graded: their Points added per game that night (epa.ts) against every player-night on record, the play
// that helped their team most and the one to fix (both with video when they have it), their record and points, how their form rating
// (form.ts) moved, and whether they were in the game of the night (drama.ts). Shown on their page and in "Next up for you".

// Grades by where the night falls among every player-night on record (its share of nights it beat). No F: it is a friends' league.
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
  beat: number // share of all player-nights this one beat (0 to 1)
  grade: string
  nights: number // player-nights on record
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
  const all = [...values.values()]
  const beat = all.length > 1 ? all.filter((v) => v < added).length / (all.length - 1) : 0.5
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
  const row = currentForm(state).rows.find((r) => r.id === pid)
  const before = row?.history.filter((h) => h.date < date).at(-1)?.mean ?? (row ? 0 : null)
  const after = row?.history.filter((h) => h.date <= date).at(-1)?.mean ?? null
  const night = dramaRanking(state).filter((d) => d.date === date)[0]
  const gameOfNight = night && tonight.some((g) => g.id === night.gameId) && dramaRanking(state).filter((d) => d.date === date).length > 1 ? night.gameId : null
  return { date, games: tonight.map((g) => g.id), wins, losses, points, added, beat, grade: gradeFor(beat), nights: all.length, best, fix, formBefore: before, formAfter: after, gameOfNight }
}

export const playLine = (p: PlayValue, name: Name) => describe(p, name)
