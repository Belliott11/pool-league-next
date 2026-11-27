import { playValues, type PlayValue } from "@/lib/epa"
import { shotSentence, turnoverSentence, type Name } from "@/lib/playWords"
import type { PooleanState } from "@/lib/types"

// The film room: which plays to watch to learn and adjust, for a game (each team's) or a player (their own, their defense, and against
// one opponent). Plays are valued by Points added (epa.ts `playValues`, the same model as everywhere on the site): "what worked" are the
// plays that left the trip worth the most, "what didn't" the least. Only plays with a video time can be watched, so only those are
// listed. Takeaways compare kinds of shots (how it was taken, the contest, off the catch or held, 2s against 3s) by points per shot,
// with at least MIN shots of a kind, so they point at habits rather than one lucky shot.
export const SHOW = 4 // plays per list
export const MIN_GAME = 3 // shots of a kind before a game takeaway
export const MIN_PLAYER = 5 // across a player's games

export type { Name }


// One play in a sentence (playWords.ts): "Zach hits a 3 off Ben's pass after getting past Ian."
export function describe(p: PlayValue, name: Name): string {
  if (p.kind === "turnover") return turnoverSentence(p.player, p.forcer, name)
  return shotSentence({ player: p.player, points: p.points, made: p.made, shotType: p.shotType, passer: p.passer, defenders: p.defenders, contest: p.contest, blocker: p.blocker, end: p.end, rebounder: p.rebounder }, name)
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

// How a player got beaten on defense: every shot where the shooter got past them, grouped by shooter, with how (shot kind) and the
// plays to watch, most often first.
export interface BeatenBy {
  id: string
  times: number
  made: number
  how: { label: string; n: number }[]
  plays: PlayValue[]
}

const HOW_LABEL: Record<string, string> = { drive: "on the drive", move: "off a move", catchAndShoot: "off the catch", deepHeave: "with a heave", dunk: "with a dunk" }

export function beatenBy(state: PooleanState, pid: string): BeatenBy[] {
  const filmed = state.games.filter((g) => !g.liveInProgress && !g.test && g.scoringEvents.length > 0).map((g) => g.id)
  const m = new Map<string, PlayValue[]>()
  for (const p of playValues(state, filmed)) if (p.kind === "shot" && p.contest === "beat" && p.defenders.includes(pid)) m.set(p.player, [...(m.get(p.player) ?? []), p])
  return [...m]
    .map(([id, ps]) => {
      const how = new Map<string, number>()
      for (const p of ps) {
        const k = p.points === 3 && p.shotType !== "deepHeave" ? "from deep" : (p.shotType && HOW_LABEL[p.shotType]) || "for two"
        how.set(k, (how.get(k) ?? 0) + 1)
      }
      return {
        id,
        times: ps.length,
        made: ps.filter((p) => p.made).length,
        how: [...how].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
        plays: watchable(ps).sort((a, b) => b.value - a.value),
      }
    })
    .sort((a, b) => b.times - a.times || b.made - a.made)
}

// Film before you play: for each player in tonight's game, the kind of shot they score most on (5+ of that kind over every filmed game),
// with up to two of their made shots of that kind to watch. Shown on the live screens until the first basket.
export interface Scout {
  id: string
  best: Takeaway
  plays: PlayValue[]
}

export function scoutGame(state: PooleanState, ids: string[]): Scout[] {
  const filmed = state.games.filter((g) => !g.liveInProgress && !g.test && g.scoringEvents.length > 0).map((g) => g.id)
  const plays = playValues(state, filmed)
  const out: Scout[] = []
  for (const id of ids) {
    const mine = plays.filter((p) => p.player === id && p.kind === "shot")
    const rows = KINDS.filter((k) => !["two", "three", "open", "heavy"].includes(k.key))
      .map((k) => {
        const s = mine.filter(k.test)
        return { k, s, label: k.label, shots: s.length, pps: s.length ? s.reduce((n, p) => n + (p.made ? p.points : 0), 0) / s.length : 0 }
      })
      .filter((r) => r.shots >= MIN_PLAYER)
      .sort((a, b) => b.pps - a.pps)
    const best = rows[0]
    if (!best) continue
    out.push({ id, best: { label: best.label, shots: best.shots, pps: best.pps }, plays: watchable(best.s.filter((p) => p.made)).sort((a, b) => b.value - a.value).slice(0, 2) })
  }
  return out
}

// One play by its game and event id, for a shared link.
export function findPlay(state: PooleanState, gameId: string, id: string): PlayValue | null {
  return playValues(state, [gameId]).find((p) => p.id === id) ?? null
}
