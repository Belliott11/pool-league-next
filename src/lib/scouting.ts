import { beatRates, countsForBeatRate } from "@/lib/beatRate"
import type { PooleanState } from "@/lib/types"

// A scouting card for one player: where they sit against the league's middle on each stat, in plain words. It reads the same rates the
// leaderboard shows (per 25 combined points) and the zone splits, and never boils a player down to one grade.
export const EARLY_GAMES = 5
export const EARLY_SHOTS = 20
const MIN_ZONE_SHOTS = 5 // a zone percentage needs this many shots to be compared at all
const MIN_GAP = 0.5 // standard deviations from the league's middle before a gap is worth a line
const MIN_SHARE_GAP = 0.15 // a shot-mix share this far from the league's middle is a tendency

// The leaderboard row fields this needs, so the card can be built (and tested) without the classic compute layer.
export interface BoardRow {
  player: { id: string }
  gp: number
  rate: { pts: number; oreb: number; dreb: number; ast: number; stl: number; blk: number }
  shooting: { fgm: number; fga: number; closeM: number; closeA: number; tpArcM: number; tpArcA: number; tpDeepM: number; tpDeepA: number }
  liveTovPer25: number
}

interface Stat {
  key: string
  label: string
  good: "high" | "low"
  get: (m: Metrics) => number | null
  text: (v: number) => string
}
export interface Metrics {
  id: string
  games: number
  shots: number
  pts: number
  reb: number
  ast: number
  stl: number
  blk: number
  liveTov: number
  fg: number | null
  rimFg: number | null
  lineFg: number | null
  deepFg: number | null
  rimShare: number | null
  lineShare: number | null
  deepShare: number | null
  beatRate: number | null // as a defender
  oppFg: number | null // shots against them, leaving beat shots out
  fgNoBeat: number | null // as a shooter, leaving shots off a beaten defender out
  beatShare: number | null // share of their shots that came off a beaten defender
}

const pc = (v: number) => `${Math.round(v * 100)}%`
const one = (v: number) => v.toFixed(1)

const STATS: Stat[] = [
  { key: "pts", label: "Scoring", good: "high", get: (m) => m.pts, text: (v) => `${one(v)} points per 25` },
  { key: "reb", label: "Rebounding", good: "high", get: (m) => m.reb, text: (v) => `${one(v)} rebounds per 25` },
  { key: "ast", label: "Passing", good: "high", get: (m) => m.ast, text: (v) => `${one(v)} assists per 25` },
  { key: "stl", label: "Steals", good: "high", get: (m) => m.stl, text: (v) => `${one(v)} steals per 25` },
  { key: "liveTov", label: "Live-ball turnovers", good: "low", get: (m) => m.liveTov, text: (v) => `${one(v)} live-ball turnovers per 25` },
  { key: "fg", label: "Shooting", good: "high", get: (m) => m.fg, text: (v) => `${pc(v)} from the field` },
  { key: "rimFg", label: "Finishing at the rim", good: "high", get: (m) => m.rimFg, text: (v) => `${pc(v)} on close shots` },
  { key: "lineFg", label: "Shooting off the 3 point line", good: "high", get: (m) => m.lineFg, text: (v) => `${pc(v)} on line threes` },
  { key: "deepFg", label: "Deep threes", good: "high", get: (m) => m.deepFg, text: (v) => `${pc(v)} on deep threes` },
  { key: "beatRate", label: "Staying in front", good: "low", get: (m) => m.beatRate, text: (v) => `beaten on ${pc(v)} of shots faced` },
  { key: "oppFg", label: "Contesting shots", good: "low", get: (m) => m.oppFg, text: (v) => `opponents shoot ${pc(v)} against them without beat shots` },
]

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : 0
}
const spread = (xs: number[]) => {
  const mean = xs.reduce((n, x) => n + x, 0) / (xs.length || 1)
  return Math.sqrt(xs.reduce((n, x) => n + (x - mean) ** 2, 0) / (xs.length || 1))
}

const share = (n: number, d: number) => (d > 0 ? n / d : null)
const zone = (m: number, a: number) => (a >= MIN_ZONE_SHOTS ? m / a : null)

// Every player's numbers, from the board rows plus the shot log (beat shots, who got beat).
export function metricsFor(state: PooleanState, rows: BoardRow[]): Metrics[] {
  const beat = new Map(beatRates(state).map((r) => [r.id, r]))
  const shots = new Map<string, { att: number; made: number; beat: number; nbAtt: number; nbMade: number }>()
  for (const g of state.games.filter(countsForBeatRate)) {
    for (const e of g.scoringEvents) {
      if (e.points !== 2 && e.points !== 3) continue
      const s = shots.get(e.scorerId) ?? shots.set(e.scorerId, { att: 0, made: 0, beat: 0, nbAtt: 0, nbMade: 0 }).get(e.scorerId)!
      s.att++
      if (e.contestLevel === "beat") s.beat++
      else {
        s.nbAtt++
        if (e.made !== false) s.nbMade++
      }
    }
  }
  return rows
    .filter((r) => r.gp > 0)
    .map((r) => {
      const sh = r.shooting
      const b = beat.get(r.player.id)
      const s = shots.get(r.player.id)
      return {
        id: r.player.id,
        games: r.gp,
        shots: sh.fga,
        pts: r.rate.pts,
        reb: r.rate.oreb + r.rate.dreb,
        ast: r.rate.ast,
        stl: r.rate.stl,
        blk: r.rate.blk,
        liveTov: r.liveTovPer25,
        fg: zone(sh.fgm, sh.fga),
        rimFg: zone(sh.closeM, sh.closeA),
        lineFg: zone(sh.tpArcM, sh.tpArcA),
        deepFg: zone(sh.tpDeepM, sh.tpDeepA),
        rimShare: share(sh.closeA, sh.fga),
        lineShare: share(sh.tpArcA, sh.fga),
        deepShare: share(sh.tpDeepA, sh.fga),
        beatRate: b && b.faced >= MIN_ZONE_SHOTS ? b.beat / b.faced : null,
        oppFg: b && b.oppAtt >= MIN_ZONE_SHOTS ? b.oppMade / b.oppAtt : null,
        fgNoBeat: s && s.nbAtt >= MIN_ZONE_SHOTS ? s.nbMade / s.nbAtt : null,
        beatShare: s && s.att >= MIN_ZONE_SHOTS ? s.beat / s.att : null,
      }
    })
}

export interface Line {
  label: string
  text: string // the player's number
  vs: string // the league's middle
}
export interface Card {
  strengths: Line[]
  workOn: Line[]
  guard: string[]
  sample: { games: number; shots: number; early: boolean; text: string }
}

const TOP = 3

export function scoutCard(all: Metrics[], id: string): Card | null {
  const me = all.find((m) => m.id === id)
  if (!me) return null
  const gaps: { stat: Stat; z: number; v: number; mid: number }[] = []
  for (const stat of STATS) {
    const v = stat.get(me)
    if (v === null) continue
    const pool = all.map((m) => stat.get(m)).filter((x): x is number => x !== null)
    if (pool.length < 3) continue
    const sd = spread(pool)
    if (sd === 0) continue
    const mid = median(pool)
    // Positive is good for the player whichever way the stat runs.
    const z = ((v - mid) / sd) * (stat.good === "high" ? 1 : -1)
    gaps.push({ stat, z, v, mid })
  }
  const line = (g: (typeof gaps)[number]): Line => ({ label: g.stat.label, text: g.stat.text(g.v), vs: `league middle: ${g.stat.text(g.mid)}` })
  const strengths = gaps.filter((g) => g.z >= MIN_GAP).sort((a, b) => b.z - a.z).slice(0, TOP).map(line)
  const workOn = gaps.filter((g) => g.z <= -MIN_GAP).sort((a, b) => a.z - b.z).slice(0, TOP).map(line)

  const tendency = (key: "rimShare" | "lineShare" | "deepShare", name: string, pctKey: "rimFg" | "lineFg" | "deepFg") => {
    const v = me[key]
    if (v === null) return null
    const mid = median(all.map((m) => m[key]).filter((x): x is number => x !== null))
    if (v - mid < MIN_SHARE_GAP * (key === "rimShare" ? 1 : 0.5)) return null
    const f = me[pctKey]
    return { gap: v - mid, text: `${pc(v)} of their shots are ${name} (league middle ${pc(mid)})${f === null ? "" : `, and they make ${pc(f)} of them`}.` }
  }
  const guard: string[] = []
  const tends = [
    tendency("rimShare", "at the rim", "rimFg"),
    tendency("lineShare", "threes off the line", "lineFg"),
    tendency("deepShare", "deep threes", "deepFg"),
  ]
    .filter((t): t is { gap: number; text: string } => t !== null)
    .sort((a, b) => b.gap - a.gap)
  for (const t of tends.slice(0, 2)) guard.push(t.text)
  if (me.fgNoBeat !== null) {
    const mid = median(all.map((m) => m.fgNoBeat).filter((x): x is number => x !== null))
    guard.push(
      me.fgNoBeat >= mid + 0.05
        ? `Even when the defender stays with them they make ${pc(me.fgNoBeat)} (league middle ${pc(mid)}, leaving out shots off a beaten defender), so contest every shot.`
        : me.fgNoBeat <= mid - 0.05
          ? `With a defender still on them they make ${pc(me.fgNoBeat)} (league middle ${pc(mid)}, leaving out shots off a beaten defender), so the way to stop them is to stay in front, not to gamble.`
          : `With a defender still on them they make ${pc(me.fgNoBeat)}, about the league middle (${pc(mid)}).`,
    )
  }
  if (me.beatShare !== null && me.beatShare >= 0.25) guard.push(`${pc(me.beatShare)} of their shots came off a beaten defender, so they get their looks by beating people, not by shooting over them.`)

  const early = me.games < EARLY_GAMES || me.shots < EARLY_SHOTS
  return {
    strengths,
    workOn,
    guard,
    sample: {
      games: me.games,
      shots: me.shots,
      early,
      text: `${early ? "Early read: " : ""}${me.games} ${me.games === 1 ? "game" : "games"} and ${me.shots} ${me.shots === 1 ? "shot" : "shots"}. ${early ? `Under ${EARLY_GAMES} games or ${EARLY_SHOTS} shots, so treat this as a first impression.` : "Enough to trust the broad strokes."}`,
    },
  }
}
