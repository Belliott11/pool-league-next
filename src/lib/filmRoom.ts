import { playValues, type PlayValue } from "@/lib/epa"
import type { PooleanState } from "@/lib/types"

// The film room: which plays to watch to learn and adjust, for a game (each team's) or a player (their own, their defense, and against
// one opponent). Plays are valued by Points added (epa.ts `playValues`, the same model as everywhere on the site): "what worked" are the
// plays that left the trip worth the most, "what didn't" the least. Only plays with a video time can be watched, so only those are
// listed. Takeaways compare kinds of shots (how it was taken, the contest, off the catch or held, 2s against 3s) by points per shot,
// with at least MIN shots of a kind, so they point at habits rather than one lucky shot.
export const SHOW = 4 // plays per list
export const MIN_GAME = 3 // shots of a kind before a game takeaway
export const MIN_PLAYER = 5 // across a player's games

export type Name = (pid: string) => string

const HOW: Record<string, string> = { drive: "on the drive", move: "off a move", catchAndShoot: "off the catch", deepHeave: "with a deep heave", dunk: "with a dunk" }

// One play in a sentence: "Zach from deep off Ben's pass, Ian guarding: good."
export function describe(p: PlayValue, name: Name): string {
  if (p.kind === "turnover") return `${name(p.player)} turned it over${p.forcer ? `, picked off by ${name(p.forcer)}` : ""}.`
  const how = p.points === 3 ? (p.shotType === "deepHeave" ? "with a deep heave" : "from deep") : (p.shotType && HOW[p.shotType]) || "for two"
  const pass = p.passer ? `, off ${name(p.passer)}'s pass` : ""
  const d = p.defenders.map(name).join(" and ")
  const guard = !p.defenders.length
    ? p.contest === "none" ? ", open" : ""
    : p.contest === "beat" ? `, got past ${d}` : p.contest === "heavy" ? `, ${d} all over it` : p.contest === "medium" ? `, ${d} contesting` : p.contest === "light" ? `, ${d} close` : p.contest === "none" ? `, ${d} not close` : `, ${d} guarding`
  const end =
    p.end === "made" ? "good" : p.blocker ? `blocked by ${name(p.blocker)}` : p.end === "out" ? "missed, out of bounds" : p.end === "kept" ? `missed, ${p.rebounder ? `${name(p.rebounder)} kept it alive` : "back to them"}` : `missed${p.rebounder ? `, ${name(p.rebounder)} with the board` : ""}`
  return `${name(p.player)} ${how}${pass}${guard}: ${end}.`
}

interface Kind {
  key: string
  label: string
  test: (p: PlayValue) => boolean
}
const KINDS: Kind[] = [
  { key: "drive", label: "drives", test: (p) => p.shotType === "drive" },
  { key: "move", label: "shots off a move", test: (p) => p.shotType === "move" },
  { key: "catch", label: "catch-and-shoot shots", test: (p) => p.shotType === "catchAndShoot" || p.catchAndShoot === true },
  { key: "held", label: "shots after holding the ball", test: (p) => p.catchAndShoot === false },
  { key: "heave", label: "deep heaves", test: (p) => p.shotType === "deepHeave" },
  { key: "open", label: "open shots", test: (p) => p.contest === "none" || p.contest === "beat" },
  { key: "heavy", label: "heavily contested shots", test: (p) => p.contest === "heavy" },
  { key: "two", label: "2s", test: (p) => p.points === 2 },
  { key: "three", label: "3s", test: (p) => p.points === 3 },
]

export interface Takeaway {
  label: string
  shots: number
  pps: number // points per shot
}

// The kinds of shots that went best and worst for these shots (points per shot), when they differ enough to matter.
export function takeaways(shots: PlayValue[], min: number): { best: Takeaway | null; worst: Takeaway | null } {
  const rows: Takeaway[] = []
  for (const k of KINDS) {
    const s = shots.filter((p) => p.kind === "shot" && k.test(p))
    if (s.length < min) continue
    rows.push({ label: k.label, shots: s.length, pps: s.reduce((n, p) => n + (p.made ? p.points : 0), 0) / s.length })
  }
  if (rows.length < 2) return { best: null, worst: null }
  rows.sort((a, b) => b.pps - a.pps)
  const best = rows[0]
  const worst = rows[rows.length - 1]
  return best.pps - worst.pps >= 0.3 ? { best, worst } : { best: null, worst: null }
}

const watchable = (ps: PlayValue[]) => ps.filter((p) => p.t !== null)
// The same kind of play (a turnover, a missed 3 out of bounds, a made 2...) at most twice in one list, so a list teaches more than one thing.
const kindOf = (p: PlayValue) => `${p.kind}|${p.points}|${p.end}`
function varied(ps: PlayValue[]): PlayValue[] {
  const seen = new Map<string, number>()
  const out: PlayValue[] = []
  for (const p of ps) {
    const k = kindOf(p)
    if ((seen.get(k) ?? 0) >= 2) continue
    seen.set(k, (seen.get(k) ?? 0) + 1)
    out.push(p)
    if (out.length === SHOW) break
  }
  return out
}
const top = (ps: PlayValue[], dir: 1 | -1, cut: number) =>
  varied(
    watchable(ps)
      .filter((p) => (dir === 1 ? p.value > cut : p.value < -cut))
      .sort((a, b) => dir * (b.value - a.value) || (a.t ?? 0) - (b.t ?? 0)),
  )

export interface TeamFilm {
  side: 0 | 1
  worked: PlayValue[]
  didnt: PlayValue[]
  mine: { best: Takeaway | null; worst: Takeaway | null } // their own shooting
  hurt: Takeaway | null // the other team's best kind of shot against them
}

export function gameFilm(state: PooleanState, gameId: string): TeamFilm[] {
  const plays = playValues(state, [gameId])
  return ([0, 1] as const).map((s) => {
    const ours = plays.filter((p) => p.side === s)
    const theirs = plays.filter((p) => p.side !== s)
    return { side: s, worked: top(ours, 1, 0.3), didnt: top(ours, -1, 0.3), mine: takeaways(ours, MIN_GAME), hurt: takeaways(theirs, MIN_GAME).best }
  })
}

export interface PlayerFilm {
  worked: PlayValue[]
  didnt: PlayValue[]
  stops: PlayValue[] // shots they guarded that missed, and turnovers they forced
  scoredOn: PlayValue[] // shots they guarded that went in
  mine: { best: Takeaway | null; worst: Takeaway | null }
  vs: null | { id: string; shotsOn: number; ppsOn: number; shotsBy: number; ppsBy: number; offense: PlayValue[]; defense: PlayValue[] }
  watchable: number
}

const pps = (ps: PlayValue[]) => {
  const s = ps.filter((p) => p.kind === "shot")
  return { n: s.length, pps: s.length ? s.reduce((n, p) => n + (p.made ? p.points : 0), 0) / s.length : 0 }
}

// A player's film over every filmed game: their own plays (as shooter, passer on a make, or who turned it over), their defense, and,
// with `vs`, what happened when they met that opponent (their shots against them, and that player's shots against them).
export function playerFilm(state: PooleanState, pid: string, vs: string | null = null): PlayerFilm {
  const filmed = state.games.filter((g) => !g.liveInProgress && !g.test && g.scoringEvents.length > 0).map((g) => g.id)
  const plays = playValues(state, filmed)
  const mine = plays.filter((p) => p.player === pid || p.passer === pid)
  const guarded = plays.filter((p) => p.defenders.includes(pid))
  const stops = varied(watchable(guarded.filter((p) => (p.kind === "shot" && !p.made) || (p.kind === "turnover" && p.forcer === pid))).sort((a, b) => a.value - b.value))
  const scoredOn = varied(watchable(guarded.filter((p) => p.kind === "shot" && p.made)).sort((a, b) => b.value - a.value))
  let vsOut: PlayerFilm["vs"] = null
  if (vs && vs !== pid) {
    const offense = plays.filter((p) => p.player === pid && p.defenders.includes(vs))
    const defense = plays.filter((p) => p.player === vs && p.defenders.includes(pid))
    const a = pps(offense)
    const b = pps(defense)
    vsOut = { id: vs, shotsOn: a.n, ppsOn: a.pps, shotsBy: b.n, ppsBy: b.pps, offense: watchable(offense).sort((x, y) => y.value - x.value), defense: watchable(defense).sort((x, y) => y.value - x.value) }
  }
  return {
    worked: top(mine, 1, 0.3),
    didnt: top(
      mine.filter((p) => p.player === pid),
      -1,
      0.3,
    ),
    stops,
    scoredOn,
    mine: takeaways(
      plays.filter((p) => p.player === pid),
      MIN_PLAYER,
    ),
    vs: vsOut,
    watchable: watchable(mine).length + watchable(guarded).length,
  }
}

// Who a player has met most on the other side, for the opponent picker (shots between them either way).
export function opponentsOf(state: PooleanState, pid: string): { id: string; n: number }[] {
  const filmed = state.games.filter((g) => !g.liveInProgress && !g.test && g.scoringEvents.length > 0).map((g) => g.id)
  const m = new Map<string, number>()
  for (const p of playValues(state, filmed)) {
    if (p.kind !== "shot") continue
    if (p.player === pid) for (const d of p.defenders) m.set(d, (m.get(d) ?? 0) + 1)
    if (p.defenders.includes(pid)) m.set(p.player, (m.get(p.player) ?? 0) + 1)
  }
  return [...m].map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n)
}
