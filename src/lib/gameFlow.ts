import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// When in a game and a night people score and shoot, built only from shots that carry a video time. A game is timed when
// it has a box score, every shot has a time, and it has enough shots to split into thirds. Everything here is derived from
// the existing shots; nothing is stored. The basket that ends a finished game is left out of every shooting measure.
export const MIN_GAME_SHOTS = 12
export const MIN_SIDE_SHOTS = 8 // each side of a comparison needs this many attempts before it can say anything
export const PLAYER_PHASE_MIN = 10 // attempts a player needs in a phase before their number is shown
export const PLAYER_HOT_MIN = 15 // attempts a player needs before their hot hand is shown
export const WARM_UP = 3 // the first shots of a player's game counted as warming up
// Only shooters with at least this many attempts in a game feed the warm-up comparison. Otherwise a player who takes two
// open shots all game lands only in the "first shots" group and flatters it; with the minimum, both groups are the same
// people.
export const WARM_MIN_SHOTS = WARM_UP * 2
export const MIN_NIGHT_GAMES = 3 // games each side of a night comparison needs; one game is an anecdote

// The z a difference must reach. Several things are compared at once and shots from one game or player are not fully
// independent, so a plain 2 and 1.3 would call chance a pattern too often.
export const CLEAR_Z = 2.5
export const HINT_Z = 1.65

export type Phase = "early" | "middle" | "late"
export const PHASES: Phase[] = ["early", "middle", "late"]
export const PHASE_LABEL: Record<Phase, string> = { early: "First third", middle: "Middle third", late: "Last third" }

export interface Rate {
  made: number
  att: number
}
export const pct = (r: Rate): number | null => (r.att > 0 ? (r.made / r.att) * 100 : null)

// A running mean: enough to say how far apart two averages are.
export interface Mean {
  sum: number
  sq: number
  n: number
}

export interface PhaseRow {
  phase: Phase
  shots: Rate
  pts: number
  threes: number // threes made, for effective FG%
  minutes: number // time in this phase, over the games counted
  turnovers: number
  steals: number
  contest: Mean
  drives: Rate // drives out of the shots that have a shot type
}

export interface NightRow {
  n: 1 | 2 | 3 // game number on the recording; 3 means 3 or later
  games: number
  shots: Rate
  pts: number
  minutes: number
  turnovers: number
  contest: Mean
  restMinutes: number[] // rest before this game, one per game that had a game before it
}

export interface Flow {
  games: number
  shots: number
  phases: PhaseRow[]
  // The same shooting by how far through the game's points it was (a third of the points, then the next third), not by
  // the clock. It ignores dead time on the video and looks at similar game states.
  byScore: Rate[]
  nights: NightRow[]
  warm: { first: Rate; rest: Rate }
  hot: { afterMake: Rate; afterMiss: Rate }
}

const CONTEST: Record<string, number> = { none: 0, beat: 0, light: 1, medium: 2, heavy: 3 }
const made = (e: ScoringEvent) => e.made !== false
const addMean = (m: Mean, v: number) => {
  m.sum += v
  m.sq += v * v
  m.n++
}
export const meanOf = (m: Mean): number | null => (m.n > 0 ? m.sum / m.n : null)

interface Timed {
  game: Game
  shots: (ScoringEvent & { t: number })[]
  // The shots that count toward rates: all of them, minus the basket that ended the game. A finished game can only end
  // on a make, and that make always lands in the last third, so keeping it would flatter the end of every game.
  counted: (ScoringEvent & { t: number })[]
  start: number
  end: number
}

// The game's shots in time order, or null when it cannot be placed in time.
export function timedGame(game: Game): Timed | null {
  if (game.liveInProgress || game.scoringEvents.length < MIN_GAME_SHOTS) return null
  if (game.scoringEvents.some((e) => typeof e.videoTime !== "number")) return null
  const shots = game.scoringEvents.map((e) => ({ ...e, t: e.videoTime as number })).sort((a, b) => a.t - b.t)
  const start = shots[0].t
  const end = shots[shots.length - 1].t
  if (!(end > start)) return null
  const last = shots[shots.length - 1]
  const counted = made(last) && !game.stoppedEarly ? shots.slice(0, -1) : shots
  return { game, shots, counted, start, end }
}

export const phaseOf = (t: number, start: number, end: number): Phase => PHASES[Math.min(2, Math.floor((3 * (t - start)) / (end - start)))]

const emptyPhase = (phase: Phase): PhaseRow => ({ phase, shots: { made: 0, att: 0 }, pts: 0, threes: 0, minutes: 0, turnovers: 0, steals: 0, contest: { sum: 0, sq: 0, n: 0 }, drives: { made: 0, att: 0 } })
const emptyNight = (n: 1 | 2 | 3): NightRow => ({ n, games: 0, shots: { made: 0, att: 0 }, pts: 0, minutes: 0, turnovers: 0, contest: { sum: 0, sq: 0, n: 0 }, restMinutes: [] })

// Games that share one recording, in the order they were played. Games on their own recording have no known order, so
// they are left out of the comparison between games of a night.
function nightOrder(timed: Timed[]): Map<string, { n: 1 | 2 | 3; rest: number | null }> {
  const groups = new Map<string, Timed[]>()
  for (const t of timed) {
    const m = t.game.masterVideoId
    if (!m) continue
    const k = `${t.game.date}|${m}`
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  const out = new Map<string, { n: 1 | 2 | 3; rest: number | null }>()
  for (const list of groups.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => (a.game.videoStart ?? a.start) - (b.game.videoStart ?? b.start))
    list.forEach((t, i) => {
      const prev = list[i - 1]
      const gap = prev ? (t.game.videoStart ?? t.start) - prev.end : null
      out.set(t.game.id, { n: Math.min(i + 1, 3) as 1 | 2 | 3, rest: gap !== null && gap > 0 ? gap / 60 : null })
    })
  }
  return out
}

function flowFor(state: PooleanState, only?: string): Flow {
  const timed = state.games.map(timedGame).filter((t): t is Timed => !!t)
  const order = nightOrder(timed)
  const phases = PHASES.map(emptyPhase)
  const byScore: Rate[] = PHASES.map(() => ({ made: 0, att: 0 }))
  const nights = ([1, 2, 3] as const).map(emptyNight)
  const warm = { first: { made: 0, att: 0 }, rest: { made: 0, att: 0 } }
  const hot = { afterMake: { made: 0, att: 0 }, afterMiss: { made: 0, att: 0 } }
  let games = 0
  let shotCount = 0

  for (const t of timed) {
    const { game, counted: shots, start, end } = t
    // Where each shot sits in the game's scoring: the points already scored out of the points scored in all.
    const totalPts = t.shots.filter(made).reduce((n, e) => n + e.points, 0)
    const endId = t.shots.length !== shots.length ? t.shots[t.shots.length - 1].id : null
    let cum = 0
    for (const e of t.shots) {
      if (e.id !== endId && totalPts > 0 && (!only || e.scorerId === only) && (!only || game.teamA.includes(only) || game.teamB.includes(only))) {
        const b = byScore[Math.min(2, Math.floor((3 * cum) / totalPts))]
        b.att++
        if (made(e)) b.made++
      }
      if (made(e)) cum += e.points
    }
    if (only && !game.teamA.includes(only) && !game.teamB.includes(only)) continue
    games++
    const third = (end - start) / 3 / 60
    for (const p of phases) p.minutes += third
    const place = order.get(game.id)
    const night = place ? nights[place.n - 1] : null
    if (night) {
      night.games++
      night.minutes += (end - start) / 60
      if (place!.rest !== null) night.restMinutes.push(place!.rest)
    }

    for (const e of shots) {
      if (only && e.scorerId !== only) continue
      shotCount++
      const row = phases[PHASES.indexOf(phaseOf(e.t, start, end))]
      const ok = made(e)
      row.shots.att++
      if (ok) {
        row.shots.made++
        row.pts += e.points
        if (e.points === 3) row.threes++
      }
      const c = e.contestLevel ? CONTEST[e.contestLevel] : undefined
      if (c !== undefined) addMean(row.contest, c)
      if (e.shotType) {
        row.drives.att++
        if (e.shotType === "drive") row.drives.made++
      }
      if (night) {
        night.shots.att++
        if (ok) {
          night.shots.made++
          night.pts += e.points
        }
        if (c !== undefined) addMean(night.contest, c)
      }
    }

    for (const tov of game.turnoverEvents) {
      if (typeof tov.videoTime !== "number" || (only && tov.playerId !== only)) continue
      phases[PHASES.indexOf(phaseOf(Math.min(Math.max(tov.videoTime, start), end), start, end))].turnovers++
      if (night) night.turnovers++
    }
    for (const st of game.stealEvents) {
      if (typeof st.videoTime !== "number" || (only && st.playerId !== only)) continue
      phases[PHASES.indexOf(phaseOf(Math.min(Math.max(st.videoTime, start), end), start, end))].steals++
    }

    // Warm-up and hot hand follow one shooter through one game; the sequence never carries into the next game.
    const bySh = new Map<string, boolean[]>()
    for (const e of shots) {
      if (only && e.scorerId !== only) continue
      bySh.set(e.scorerId, [...(bySh.get(e.scorerId) ?? []), made(e)])
    }
    for (const seq of bySh.values()) {
      seq.forEach((ok, i) => {
        if (seq.length >= WARM_MIN_SHOTS) {
          const bucket = i < WARM_UP ? warm.first : warm.rest
          bucket.att++
          if (ok) bucket.made++
        }
        if (i > 0) {
          const after = seq[i - 1] ? hot.afterMake : hot.afterMiss
          after.att++
          if (ok) after.made++
        }
      })
    }
  }
  return { games, shots: shotCount, phases, byScore, nights, warm, hot }
}

export const leagueFlow = (state: PooleanState): Flow => flowFor(state)
export const playerFlow = (state: PooleanState, id: string): Flow => flowFor(state, id)

export type Verdict = "clear" | "hint" | "early"

export interface Comparison {
  diff: number | null // b minus a, in percentage points
  z: number | null
  verdict: Verdict
}

// Whether two shooting rates really differ: a two-proportion z-test, said in words. Under MIN_SIDE_SHOTS a side is too
// small to say anything.
export function compareRates(a: Rate, b: Rate): Comparison {
  if (a.att < MIN_SIDE_SHOTS || b.att < MIN_SIDE_SHOTS) return { diff: null, z: null, verdict: "early" }
  const pa = a.made / a.att
  const pb = b.made / b.att
  const pooled = (a.made + b.made) / (a.att + b.att)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.att + 1 / b.att))
  const z = se > 0 ? (pb - pa) / se : 0
  return { diff: (pb - pa) * 100, z, verdict: verdictOf(z) }
}

const verdictOf = (z: number): Verdict => (Math.abs(z) >= CLEAR_Z ? "clear" : Math.abs(z) >= HINT_Z ? "hint" : "early")

// The same question for averages (how hard shots are contested): a z from the two means and their spread. diff is b minus a.
export function compareMeans(a: Mean, b: Mean): { diff: number | null; verdict: Verdict } {
  if (a.n < MIN_SIDE_SHOTS || b.n < MIN_SIDE_SHOTS) return { diff: null, verdict: "early" }
  const va = Math.max(0, a.sq / a.n - (a.sum / a.n) ** 2) / a.n
  const vb = Math.max(0, b.sq / b.n - (b.sum / b.n) ** 2) / b.n
  const diff = b.sum / b.n - a.sum / a.n
  const se = Math.sqrt(va + vb)
  // No spread at all in either group (every value identical): any gap between the averages is real.
  return { diff, verdict: se > 0 ? verdictOf(diff / se) : diff !== 0 ? "clear" : "early" }
}

// Everything after the first game of a night, as one group, so the comparison is not decided by one lonely game.
export function laterGames(f: Flow): NightRow {
  const out = emptyNight(2)
  for (const n of f.nights.slice(1)) {
    out.games += n.games
    out.shots.made += n.shots.made
    out.shots.att += n.shots.att
    out.pts += n.pts
    out.minutes += n.minutes
    out.turnovers += n.turnovers
    out.contest.sum += n.contest.sum
    out.contest.sq += n.contest.sq
    out.contest.n += n.contest.n
    out.restMinutes.push(...n.restMinutes)
  }
  return out
}

// First game of a night against the rest. Needs MIN_NIGHT_GAMES on each side.
export function compareNights(f: Flow): Comparison {
  const first = f.nights[0]
  const later = laterGames(f)
  if (first.games < MIN_NIGHT_GAMES || later.games < MIN_NIGHT_GAMES) return { diff: null, z: null, verdict: "early" }
  return compareRates(first.shots, later.shots)
}

export const VERDICT_LABEL: Record<Verdict, string> = { clear: "Clear difference", hint: "A hint", early: "Too early to tell" }

const pctText = (r: Rate) => `${Math.round(pct(r) ?? 0)}%`

// One plain sentence about the whole picture, built only from what the comparisons support.
export function flowSummary(f: Flow): string {
  const parts: string[] = []
  const early = f.phases[0].shots
  const late = f.phases[2].shots
  const c = compareRates(early, late)
  if (c.verdict !== "early" && c.diff !== null) {
    const dir = c.diff > 0 ? "better" : "worse"
    parts.push(`Shooting is ${Math.abs(Math.round(c.diff))} points ${dir} in the last third than the first (${pctText(early)} to ${pctText(late)}), ${c.verdict === "clear" ? "a clear difference" : "though only a hint"}.`)
  } else {
    parts.push(`No clear pattern between the first and last third of games yet (${pctText(early)} then ${pctText(late)}).`)
  }
  const sc = compareRates(f.byScore[0], f.byScore[2])
  if (sc.verdict !== "early" && sc.diff !== null) {
    parts.push(`Counted by points scored instead of the clock, shooting goes from ${pctText(f.byScore[0])} early to ${pctText(f.byScore[2])} late (${sc.verdict === "clear" ? "clear" : "a hint"}).`)
  }
  const n = compareNights(f)
  if (n.verdict !== "early" && n.diff !== null) {
    parts.push(`Later games on a night shoot ${Math.abs(Math.round(n.diff))} points ${n.diff > 0 ? "better" : "worse"} than the first (${n.verdict === "clear" ? "clear" : "a hint"}).`)
  }
  const w = compareRates(f.warm.rest, f.warm.first)
  if (w.verdict !== "early" && w.diff !== null) {
    parts.push(`The first ${WARM_UP} shots of a game go in ${pctText(f.warm.first)} of the time against ${pctText(f.warm.rest)} after that (${w.verdict === "clear" ? "clear" : "a hint"}).`)
  }
  const h = compareRates(f.hot.afterMiss, f.hot.afterMake)
  if (h.verdict !== "early" && h.diff !== null && h.diff > 0) parts.push(`Players shoot better after a make than after a miss (${pctText(f.hot.afterMake)} against ${pctText(f.hot.afterMiss)}).`)
  return parts.join(" ")
}
