import { beatRates } from "@/lib/beatRate"
import { careers, oldGames } from "@/lib/hallOfFame"
import { passBlame, shotsCreated, turnoverCost, winProbAdded } from "@/lib/insight"
import { playerIdentity } from "@/lib/playerIdentity"
import { applyPronouns } from "@/lib/pronouns"
import type { RealGame } from "@/lib/real"
import { computeLeaderboard, gameTotalPoints, qualifyingGamesForPlayer } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"
import { winImpact } from "@/lib/winImpact"

// A plain-language read of every regular's non-box-score stats, written fresh from the data each time: one headline and a line each for
// shooting, passing, the ball, defense, boards and winning, every number set against the league's middle.
export const READ_MIN_GAMES = 3
export const EARLY_GAMES = 4 // fewer than this many games is marked an early read
const GAP = 0.6 // standard deviations from the middle before a stat counts as a strength or a weak spot
const FREE_REBOUND = 0.5

export type Tone = "good" | "bad" | null
export interface Line {
  label: string
  text: string
  tone: Tone
}
export interface Metrics {
  id: string
  games: number
  shots: number
  ts: number | null
  quality: number | null // shot quality against the league, in points a shot
  open: number | null
  heldIn: [number, number] // contested shots off a pass held first, of those tagged
  setups: number | null // per 25
  setupQuality: number | null
  setupFg: number | null
  ast: number | null
  realAst: number | null
  teammatesHeld: [number, number] // of their contested set-ups, how many the shooter held
  liveTov: number
  forced: number
  giveaways: number
  beatRate: number | null
  faced: number
  oppFg: number | null // in position, leaving out beat shots
  load: number | null
  reb: number
  fought: number
  contested: number | null // share of their rebounds that were contested
  wpa: number | null // win chance net per 25, in points of win chance
  impact: { value: number; games: number; sure: string } | null
  career: [number, number] | null // wins and losses over every result
}
export interface Read {
  id: string
  early: boolean
  headline: string
  lines: Line[]
  m: Metrics
}
export interface Reads {
  reads: Read[]
  middle: Partial<Record<keyof Metrics, number>>
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : 0
}
const sd = (xs: number[]) => {
  const m = xs.reduce((n, x) => n + x, 0) / (xs.length || 1)
  return Math.sqrt(xs.reduce((n, x) => n + (x - m) ** 2, 0) / (xs.length || 1))
}
const pc = (v: number) => `${Math.round(v * 100)}%`
const one = (v: number) => v.toFixed(1)
const signed = (v: number, d = 2) => `${v >= 0 ? "+" : ""}${v.toFixed(d)}`

function metricsFor(state: PooleanState, old: RealGame[]): Metrics[] {
  const board = computeLeaderboard(state).filter((r) => r.gp >= READ_MIN_GAMES)
  const beat = new Map(beatRates(state).map((r) => [r.id, r]))
  const ident = new Map(playerIdentity(state).rows.map((r) => [r.id, r]))
  const created = new Map(shotsCreated(state).rows.map((r) => [r.id, r]))
  const blame = new Map(passBlame(state).map((r) => [r.id, r]))
  const tov = new Map(turnoverCost(state).rows.map((r) => [r.id, r]))
  const wpa = new Map(winProbAdded(state).rows.map((r) => [r.id, r]))
  const impact = new Map(winImpact(state, old).rows.map((r) => [r.id, r]))
  const career = new Map(careers(state, old).map((r) => [r.id, r]))
  return board.map((r) => {
    const id = r.player.id
    const games = qualifyingGamesForPlayer(state, id)
    const combined = games.reduce((s, g) => s + gameTotalPoints(g), 0)
    const per25 = (v: number) => (combined ? (v / combined) * 25 : 0)
    // Defensive load leaving out beat shots and splitting double teams, and rebounds weighted by whether anyone fought for them.
    let mine = 0
    let share = 0
    let rebs = 0
    let free = 0
    let fought = 0
    for (const g of games) {
      const team = g.teamA.includes(id) ? g.teamA : g.teamB
      const opp = team === g.teamA ? g.teamB : g.teamA
      const tagged = g.scoringEvents.filter((e) => opp.includes(e.scorerId) && (e.points === 2 || e.points === 3) && (e.defenderIds ?? []).length > 0 && e.contestLevel !== "beat")
      if (tagged.length) share += tagged.length / team.length
      for (const e of tagged) if (e.defenderIds!.includes(id)) mine += 1 / e.defenderIds!.length
      for (const e of g.scoringEvents) {
        if (e.made !== false || e.rebounderId !== id || e.turnoverEventId) continue
        rebs++
        if (e.reboundNoContest) free++
        else if ((e.reboundContesterIds ?? []).length) fought++
      }
    }
    const b = beat.get(id)
    const i = ident.get(id)
    const c = created.get(id)
    const bl = blame.get(id)
    const t = tov.get(id)
    const w = wpa.get(id)
    const im = impact.get(id)
    const ca = career.get(id)
    return {
      id,
      games: r.gp,
      shots: r.shooting.fga,
      ts: r.tsPct === null ? null : r.tsPct / 100,
      quality: i ? i.qualityVsLeague : null,
      open: i ? i.open : null,
      heldIn: [bl?.held ?? 0, bl?.shots ?? 0],
      setups: c ? c.created25 : null,
      setupQuality: c && c.created ? c.expected : null,
      setupFg: c && c.created ? c.made / c.created : null,
      ast: c ? c.assists25 : null,
      realAst: c ? c.realAssists25 : null,
      teammatesHeld: bl ? [bl.setUps - bl.onPass, bl.setUps] : [0, 0],
      liveTov: r.liveTovPer25,
      forced: t?.forced ?? 0,
      giveaways: t?.giveaways ?? 0,
      beatRate: b && b.faced ? b.beat / b.faced : null,
      faced: b?.faced ?? 0,
      oppFg: b && b.oppAtt ? b.oppMade / b.oppAtt : null,
      load: share >= 3 ? mine / share : null,
      reb: per25(rebs),
      fought: per25(rebs - (1 - FREE_REBOUND) * free),
      contested: rebs ? fought / rebs : null,
      wpa: w ? w.net25 * 100 : null,
      impact: im ? { value: im.impact, games: im.games, sure: im.sure } : null,
      career: ca ? [ca.w, ca.gp - ca.w] : null,
    }
  })
}

// The stats a headline can name, with which way is better.
const HEADLINE: { key: keyof Metrics; good: "high" | "low"; strength: string; weak: string }[] = [
  { key: "ts", good: "high", strength: "shooting", weak: "Shooting" },
  { key: "quality", good: "high", strength: "getting good looks", weak: "Shot selection" },
  { key: "setups", good: "high", strength: "setting up teammates", weak: "Passing" },
  { key: "liveTov", good: "low", strength: "taking care of the ball", weak: "Ball security" },
  { key: "beatRate", good: "low", strength: "staying in front", weak: "Getting beaten" },
  { key: "oppFg", good: "low", strength: "contesting", weak: "Contesting" },
  { key: "fought", good: "high", strength: "rebounding", weak: "Rebounding" },
]

export function advancedReads(state: PooleanState, old: RealGame[] = oldGames()): Reads {
  const all = metricsFor(state, old)
  const pool = (k: keyof Metrics) => all.map((m) => m[k]).filter((v): v is number => typeof v === "number")
  const keys: (keyof Metrics)[] = ["ts", "quality", "open", "setups", "setupQuality", "liveTov", "beatRate", "oppFg", "load", "reb", "fought", "wpa"]
  const middle: Reads["middle"] = {}
  for (const k of keys) middle[k] = median(pool(k))
  const mid = (k: keyof Metrics) => middle[k] ?? 0
  // Above or below the middle by enough to say so, in the good direction for that stat.
  const tone = (k: keyof Metrics, v: number | null, good: "high" | "low"): Tone => {
    if (v === null) return null
    const s = sd(pool(k))
    if (!s) return null
    const z = ((v - mid(k)) / s) * (good === "high" ? 1 : -1)
    return z >= GAP ? "good" : z <= -GAP ? "bad" : null
  }
  const z = (k: keyof Metrics, v: number | null, good: "high" | "low") => {
    const s = sd(pool(k))
    return v === null || !s ? 0 : ((v - mid(k)) / s) * (good === "high" ? 1 : -1)
  }

  const reads = all.map((m): Read => {
    const lines: Line[] = []
    // Shooting
    {
      const parts = [m.ts === null ? "No shots yet." : `${pc(m.ts)} TS against a league middle of ${pc(mid("ts"))}.`]
      if (m.quality !== null) parts.push(`Shot quality ${signed(m.quality)} points a shot against the league${m.open !== null ? `, with ${pc(m.open)} of shots open` : ""}.`)
      if (m.heldIn[1] >= 4 && m.heldIn[0] / m.heldIn[1] >= 0.6) parts.push(`Holds the ball on contested shots off a pass: ${m.heldIn[0]} of ${m.heldIn[1]}.`)
      lines.push({ label: "Shooting", text: parts.join(" "), tone: tone("ts", m.ts, "high") })
    }
    // Passing
    if (m.setups !== null) {
      const parts = [`${one(m.setups)} set-ups per 25 (middle ${one(mid("setups"))})`]
      if (m.setupQuality !== null) parts[0] += ` worth ${m.setupQuality.toFixed(2)} points a shot (middle ${mid("setupQuality").toFixed(2)}).`
      else parts[0] += "."
      if (m.setupFg !== null) parts.push(`${pc(m.setupFg)} of them go in.`)
      if (m.teammatesHeld[1] >= 4 && m.teammatesHeld[0] / m.teammatesHeld[1] >= 0.6) parts.push(`Of their contested set-ups, teammates held the ball first on ${m.teammatesHeld[0]} of ${m.teammatesHeld[1]}.`)
      if (m.ast !== null && m.realAst !== null && m.ast > 0 && m.realAst / m.ast <= 0.6) parts.push(`Real AST ${one(m.realAst)} against ${one(m.ast)} assists: many of their assists were teammates holding and making a contested shot.`)
      lines.push({ label: "Passing", text: parts.join(" "), tone: tone("setups", m.setups, "high") })
    }
    // The ball
    lines.push({
      label: "Ball",
      text: `${one(m.liveTov)} live-ball turnovers per 25 (middle ${one(mid("liveTov"))}). Forced ${m.forced} against ${m.giveaways} giveaways.`,
      tone: tone("liveTov", m.liveTov, "low"),
    })
    // Defense
    {
      const parts: string[] = []
      if (m.beatRate !== null) parts.push(`Beaten on ${pc(m.beatRate)} of shots faced (middle ${pc(mid("beatRate"))}).`)
      if (m.oppFg !== null) parts.push(`Opponents shoot ${pc(m.oppFg)} with them in position (middle ${pc(mid("oppFg"))}).`)
      if (m.load !== null) parts.push(`Def Load ${m.load.toFixed(2)}x${m.load >= 1.2 ? ", more than their share" : m.load <= 0.75 ? ", less than their share" : ""}.`)
      if (parts.length === 0) parts.push("Not tagged on enough shots to read.")
      const t1 = tone("beatRate", m.beatRate, "low")
      const t2 = tone("oppFg", m.oppFg, "low")
      lines.push({ label: "Defense", text: parts.join(" "), tone: t1 === t2 ? t1 : t1 && !t2 ? t1 : !t1 ? t2 : null })
    }
    // Boards
    lines.push({
      label: "Boards",
      text: `${one(m.reb)} rebounds per 25, ${one(m.fought)} counting uncontested ones as half (middle ${one(mid("fought"))})${m.contested !== null ? `. ${pc(m.contested)} of them contested` : ""}.`,
      tone: tone("fought", m.fought, "high"),
    })
    // Winning
    {
      const parts: string[] = []
      if (m.wpa !== null) parts.push(`${signed(m.wpa, 0)} on Win chance added.`)
      if (m.impact) parts.push(`Win impact ${signed(m.impact.value, 1)} over ${m.impact.games} games${m.impact.sure === "early" ? ", too close to call" : ""}.`)
      if (m.career) parts.push(`${m.career[0]}-${m.career[1]} over every result.`)
      const t = m.impact && m.impact.sure !== "early" ? (m.impact.value > 0 ? "good" : "bad") : null
      lines.push({ label: "Winning", text: parts.join(" ") || "Not enough results yet.", tone: t })
    }

    // Headline: the clearest strength and the clearest weak spot, if either stands out.
    const gaps = HEADLINE.map((h) => ({ h, z: z(h.key, m[h.key] as number | null, h.good) })).filter((g) => m[g.h.key] !== null)
    const best = [...gaps].sort((a, b) => b.z - a.z)[0]
    const worst = [...gaps].sort((a, b) => a.z - b.z)[0]
    const strong = best && best.z >= GAP ? best.h.strength : null
    const weak = worst && worst.z <= -GAP ? worst.h.weak : null
    const headline = strong && weak ? `Best at ${strong}. ${weak} is the weak spot.` : strong ? `Stands out at ${strong}.` : weak ? `${weak} is the weak spot. The rest sits near the middle.` : "Close to the league middle across the board."
    const pick = state.players.find((p) => p.id === m.id)?.pronouns
    return { id: m.id, early: m.games < EARLY_GAMES, headline, lines: lines.map((l) => ({ ...l, text: applyPronouns(l.text, pick) })), m }
  })
  return { reads: reads.sort((a, b) => b.m.games - a.m.games || a.id.localeCompare(b.id)), middle }
}
