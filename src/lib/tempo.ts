import { CLEAR_Z, compareMeans, compareRates, HINT_Z, PHASES, phaseOf, timedGame, type Mean, type Phase, type Rate, type Verdict } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// Pace, scoring runs, lead swings and shooting by score state, all from games whose shots carry video times (the same
// games as Game flow). Nothing is stored. There is no possession data, so "pace" counts logged plays (every shot and
// turnover) and "time between plays" stands in for how long a possession lasts.
export const GAP_CAP = 60 // a gap longer than this many seconds is a break in the video, not play
export const MIN_RUN_BASKETS = 8 // made baskets a game needs before its runs mean anything
export const TRAIL = 3 // margin (in points) that counts as trailing or leading, not close

export interface PacePhase {
  phase: Phase
  plays: number
  minutes: number
  gaps: Mean
}
export interface Run {
  gameId: string
  date: string
  points: number
  baskets: number
}
export interface Streaky {
  games: number
  observed: number // runs seen, over every game counted
  expected: number // runs expected if baskets landed in random order, given each game's split
  z: number | null // negative: fewer, longer runs than chance
  verdict: Verdict
}
export interface Comeback {
  gameId: string
  date: string
  deficit: number
}
export interface Tempo {
  games: number
  plays: number
  minutes: number
  gapMedian: number | null // seconds between plays
  phases: PacePhase[]
  paceDrift: { diff: number | null; verdict: Verdict } // last third's time between plays minus the first's, in seconds
  runs: { top: Run[]; streaky: Streaky; games: number }
  swings: { games: number; leadChanges: number; ties: number; comebacks: Comeback[]; withComeback: number }
  state: { trailing: Rate; close: Rate; leading: Rate }
}

const mean = (): Mean => ({ sum: 0, sq: 0, n: 0 })
const rate = (): Rate => ({ made: 0, att: 0 })
const verdictOf = (z: number): Verdict => (Math.abs(z) >= CLEAR_Z ? "clear" : Math.abs(z) >= HINT_Z ? "hint" : "early")

export function tempo(state: PooleanState): Tempo {
  const out: Tempo = {
    games: 0,
    plays: 0,
    minutes: 0,
    gapMedian: null,
    phases: PHASES.map((phase) => ({ phase, plays: 0, minutes: 0, gaps: mean() })),
    paceDrift: { diff: null, verdict: "early" },
    runs: { top: [], streaky: { games: 0, observed: 0, expected: 0, z: null, verdict: "early" }, games: 0 },
    swings: { games: 0, leadChanges: 0, ties: 0, comebacks: [], withComeback: 0 },
    state: { trailing: rate(), close: rate(), leading: rate() },
  }
  const gaps: number[] = []
  let variance = 0

  for (const t of state.games.map(timedGame)) {
    if (!t) continue
    const { game, shots, start, end } = t
    out.games++

    // Pace: every logged play in time order, and the gaps between neighbours.
    const times = [...shots.map((s) => s.t), ...game.turnoverEvents.map((x) => x.videoTime).filter((v): v is number => typeof v === "number" && v >= start && v <= end)].sort((a, b) => a - b)
    out.plays += times.length
    out.minutes += (end - start) / 60
    for (const p of out.phases) p.minutes += (end - start) / 180
    times.forEach((tm, i) => {
      const ph = out.phases[PHASES.indexOf(phaseOf(tm, start, end))]
      ph.plays++
      if (i === 0) return
      const gap = tm - times[i - 1]
      if (gap > GAP_CAP) return
      gaps.push(gap)
      ph.gaps.sum += gap
      ph.gaps.sq += gap * gap
      ph.gaps.n++
    })

    // Scoring: made baskets in order, each by team 0 or 1. Shots by someone on neither team are skipped.
    const teamOf = (id: string) => (game.teamA.includes(id) ? 0 : game.teamB.includes(id) ? 1 : -1)
    const endId = t.shots.length !== t.counted.length ? t.shots[t.shots.length - 1].id : null
    const score = [0, 0]
    let leader = 0 // last team to lead, 0 for nobody yet, else 1 or 2
    let worstTrail = [0, 0] // the most each team trailed by
    const baskets: { team: number; points: number }[] = []
    for (const e of shots) {
      const tm = teamOf(e.scorerId)
      if (tm < 0) continue
      const margin = score[tm] - score[1 - tm]
      if (e.id !== endId) {
        const b = margin <= -TRAIL ? out.state.trailing : margin >= TRAIL ? out.state.leading : out.state.close
        b.att++
        if (e.made !== false) b.made++
      }
      if (e.made === false) continue
      score[tm] += e.points
      baskets.push({ team: tm, points: e.points })
      for (const side of [0, 1]) worstTrail[side] = Math.max(worstTrail[side], score[1 - side] - score[side])
      const lead = score[0] > score[1] ? 1 : score[1] > score[0] ? 2 : 0
      if (lead === 0) out.swings.ties++
      else {
        if (leader !== 0 && leader !== lead) out.swings.leadChanges++
        leader = lead
      }
    }
    if (baskets.length >= 2) out.swings.games++
    if (score[0] !== score[1] && baskets.length >= 2) {
      const winner = score[0] > score[1] ? 0 : 1
      if (worstTrail[winner] > 0) {
        out.swings.withComeback++
        out.swings.comebacks.push({ gameId: game.id, date: game.date, deficit: worstTrail[winner] })
      }
    }

    // Runs: unanswered baskets by one team. Compared with the number of runs a random order of the same baskets gives.
    const k = baskets.filter((b) => b.team === 0).length
    const l = baskets.length - k
    if (baskets.length >= MIN_RUN_BASKETS && k > 0 && l > 0) {
      let runs = 0
      let pts = 0
      let n = 0
      const close = () => {
        if (n > 0) out.runs.top.push({ gameId: game.id, date: game.date, points: pts, baskets: n })
      }
      baskets.forEach((b, i) => {
        if (i === 0 || b.team !== baskets[i - 1].team) {
          close()
          runs++
          pts = 0
          n = 0
        }
        pts += b.points
        n++
      })
      close()
      const total = baskets.length
      out.runs.games++
      out.runs.streaky.observed += runs
      out.runs.streaky.expected += 1 + (2 * k * l) / total
      variance += (2 * k * l * (2 * k * l - total)) / (total * total * (total - 1))
    }
  }

  const sorted = [...gaps].sort((a, b) => a - b)
  out.gapMedian = sorted.length ? (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2 : null
  out.paceDrift = (() => {
    const c = compareMeans(out.phases[0].gaps, out.phases[2].gaps)
    return { diff: c.diff, verdict: c.verdict }
  })()
  const s = out.runs.streaky
  s.games = out.runs.games
  if (out.runs.games >= 3 && variance > 0) {
    s.z = (s.observed - s.expected) / Math.sqrt(variance)
    s.verdict = verdictOf(s.z)
  }
  out.runs.top = out.runs.top.sort((a, b) => b.points - a.points || b.baskets - a.baskets).slice(0, 3)
  out.swings.comebacks = out.swings.comebacks.sort((a, b) => b.deficit - a.deficit).slice(0, 3)
  return out
}

export const stateCompare = (t: Tempo) => compareRates(t.state.trailing, t.state.leading)
