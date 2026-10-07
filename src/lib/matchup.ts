// Real matchup predictor, ported verbatim from app.js ("Real matchup predictor" section).
// Win odds for any two teams, from a small logistic model trained on every real game in every
// imported season. Three inputs, each measured only from what was known BEFORE that game:
//   1. power rankings, 2. extra player (team size difference), 3. history together and against.
// No intercept, so swapping which side is "A" just flips the odds.
import { realSeasonsInOrder, type PairRecord, type RealGame } from "./real"
import { isLiveScoreOnly, liveScoreOf, teamScore } from "./stats"
import type { Game } from "./types"

export const REAL_MATCHUP_MIN_GAMES = 15
const REAL_MATCHUP_L2 = 0.05
// The fitted odds are pulled toward 50/50 by this factor on the logit scale. Predicting each game from
// only the games before it, the raw odds were overconfident (its 80%+ calls were right about two times
// in three), and shrinking them lowered log loss on every window tested. It never changes which side is
// favored, only how sure the number sounds.
const PREGAME_SHRINK = 0.7
const REAL_MATCHUP_FACTOR_LABELS = ["Power rankings", "Extra player", "History together and against"]

// Real percentile assumed for a player with literally no track record at all (see app.js).
export const UNKNOWN_PLAYER_PCT = 10

type Features = [number, number, number]
type Rec = { w: number; gp: number } | undefined
type Lookup2 = (p: string, q: string) => Rec

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

// Real play order: by date, then CREATED timestamp, then game number.
const byPlayOrder = (x: RealGame, y: RealGame) =>
  x.date.localeCompare(y.date) ||
  (x.created && y.created ? x.created.localeCompare(y.created) : 0) ||
  x.n - y.n

const shrunkEdge = (rec: Rec) => (rec ? (rec.w + 2.5) / (rec.gp + 5) - 0.5 : 0)

function realMatchupFeatures(
  a: string[],
  b: string[],
  pctOf: (id: string) => number,
  togetherOf: Lookup2,
  againstOf: Lookup2,
): Features {
  const avg = (ids: string[]) => ids.reduce((sum, id) => sum + pctOf(id), 0) / ids.length
  const chem = (ids: string[]) => {
    let sum = 0
    let n = 0
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        sum += shrunkEdge(togetherOf(ids[i], ids[j]))
        n++
      }
    return n ? sum / n : 0
  }
  let h2h = 0
  let n = 0
  a.forEach((x) =>
    b.forEach((y) => {
      h2h += shrunkEdge(againstOf(x, y))
      n++
    }),
  )
  return [(avg(a) - avg(b)) / 10, a.length - b.length, 10 * (chem(a) - chem(b) + (n ? h2h / n : 0))]
}

interface Row {
  x: Features
  y: 0 | 1
}

// Games scored in this app after the imported history ends also teach the model, so it keeps learning
// as the league plays. Only decided games count (a winner by score), not live ones or stopped-early ones.
let appGames: RealGame[] = []
// The ids of those games, in the same order, so a past game can be matched to its backtest call.
let appGameIds: string[] = []
let appSignature = ""

function lastRealDate(): string {
  let last = ""
  realSeasonsInOrder().forEach((s) => s.games.forEach((g) => (g.date > last ? (last = g.date) : last)))
  return last
}

export function setAppGames(games: Game[]) {
  const after = lastRealDate()
  const decided = games
    .filter((g) => !g.liveInProgress && !g.stoppedEarly && g.date > after && g.teamA.length > 0 && g.teamB.length > 0)
    .map((g) => {
      const live = isLiveScoreOnly(g)
      const a = live ? liveScoreOf(g, g.teamA) : teamScore(g, g.teamA)
      const b = live ? liveScoreOf(g, g.teamB) : teamScore(g, g.teamB)
      return { g, a, b }
    })
    .filter((x) => x.a !== x.b)
    .sort((x, y) => x.g.date.localeCompare(y.g.date))
  const sig = decided.map((x) => x.g.id).join(",")
  if (sig === appSignature) return
  appSignature = sig
  appGames = decided.map((x, i) => ({ n: i, date: x.g.date, a: x.g.teamA, b: x.g.teamB, w: x.a > x.b ? "A" : "B" }))
  appGameIds = decided.map((x) => x.g.id)
  modelCache = null
  trackCache = null
  backtestCache = null
}

function buildRealMatchupRows(): Row[] {
  const rows: Row[] = []
  const together: Record<string, { w: number; gp: number }> = {}
  const against: Record<string, { w: number; gp: number }> = {}
  const bump = (map: Record<string, { w: number; gp: number }>, key: string, won: boolean) => {
    const r = map[key] || (map[key] = { w: 0, gp: 0 })
    r.gp++
    if (won) r.w++
  }
  let prevCards: Record<string, { powerPct: number }> | null = null
  realSeasonsInOrder().forEach((season) => {
    const nightPcts: Record<string, number[]> = {}
    const rankings = [...season.rankings].sort((x, y) => x.date.localeCompare(y.date))
    let ri = 0
    ;[...season.games].sort(byPlayOrder).forEach((g) => {
      while (ri < rankings.length && rankings[ri].date < g.date) {
        rankings[ri].players.forEach((p) => (nightPcts[p.slug] = nightPcts[p.slug] || []).push(p.pct))
        ri++
      }
      const pctOf = (id: string) => {
        const v = nightPcts[id]
        if (v && v.length) return v.reduce((x, y) => x + y, 0) / v.length
        return prevCards && prevCards[id] ? prevCards[id].powerPct : UNKNOWN_PLAYER_PCT
      }
      const x = realMatchupFeatures(
        g.a,
        g.b,
        pctOf,
        (p, q) => together[[p, q].sort().join("|")],
        (p, q) => against[`${p}|${q}`],
      )
      const aWon = g.w === "A"
      rows.push({ x, y: aWon ? 1 : 0 })
      const pairs = (ids: string[]) =>
        ids.flatMap((p, i) => ids.slice(i + 1).map((q) => [p, q].sort().join("|")))
      pairs(g.a).forEach((k) => bump(together, k, aWon))
      pairs(g.b).forEach((k) => bump(together, k, !aWon))
      g.a.forEach((p) =>
        g.b.forEach((q) => {
          bump(against, `${p}|${q}`, aWon)
          bump(against, `${q}|${p}`, !aWon)
        }),
      )
    })
    prevCards = season.cards
  })
  // Games played in this app since the imported history: features from what was known before them.
  if (appGames.length) {
    const L = realMatchupLookups()
    appGames.forEach((g) => {
      const x = realMatchupFeatures(g.a, g.b, (id) => (prevCards && prevCards[id] ? prevCards[id].powerPct : L.pctOf(id)), (p, q) => together[[p, q].sort().join("|")], (p, q) => against[`${p}|${q}`])
      const aWon = g.w === "A"
      rows.push({ x, y: aWon ? 1 : 0 })
      const pairs = (ids: string[]) => ids.flatMap((p, i) => ids.slice(i + 1).map((q) => [p, q].sort().join("|")))
      pairs(g.a).forEach((k) => bump(together, k, aWon))
      pairs(g.b).forEach((k) => bump(together, k, !aWon))
      g.a.forEach((p) =>
        g.b.forEach((q) => {
          bump(against, `${p}|${q}`, aWon)
          bump(against, `${q}|${p}`, !aWon)
        }),
      )
    })
  }
  return rows
}

function fitRealMatchupWeights(rows: Row[], start: Features = [0, 0, 0], iterations = 1500): Features {
  const w: Features = [...start]
  const lr = 0.1
  for (let it = 0; it < iterations; it++) {
    const g = [0, 0, 0]
    rows.forEach((r) => {
      const err = sigmoid(w[0] * r.x[0] + w[1] * r.x[1] + w[2] * r.x[2]) - r.y
      for (let k = 0; k < 3; k++) g[k] += err * r.x[k]
    })
    for (let k = 0; k < 3; k++) w[k] -= lr * (g[k] / rows.length + REAL_MATCHUP_L2 * w[k])
  }
  return w
}

// Where everyone stands right now: latest season's power ranking % (earlier season's for anyone
// not ranked this season), and every season's together/against records summed.
function realMatchupLookups() {
  const pct: Record<string, number> = {}
  const together: Record<string, { w: number; gp: number }> = {}
  const against: Record<string, { w: number; gp: number }> = {}
  const add = (map: Record<string, { w: number; gp: number }>, src: Record<string, PairRecord>) =>
    Object.entries(src).forEach(([k, v]) => {
      const r = map[k] || (map[k] = { w: 0, gp: 0 })
      r.w += v.w
      r.gp += v.gp
    })
  realSeasonsInOrder().forEach((season) => {
    Object.entries(season.cards).forEach(([slug, c]) => {
      pct[slug] = c.powerPct
    })
    add(together, season.together)
    add(against, season.against)
  })
  appGames.forEach((g) => {
    const aWon = g.w === "A"
    const bumpRec = (map: Record<string, { w: number; gp: number }>, key: string, won: boolean) => {
      const r = map[key] || (map[key] = { w: 0, gp: 0 })
      r.gp++
      if (won) r.w++
    }
    const pairs = (ids: string[]) => ids.flatMap((p, i) => ids.slice(i + 1).map((q) => [p, q].sort().join("|")))
    pairs(g.a).forEach((k) => bumpRec(together, k, aWon))
    pairs(g.b).forEach((k) => bumpRec(together, k, !aWon))
    g.a.forEach((p) =>
      g.b.forEach((q) => {
        bumpRec(against, `${p}|${q}`, aWon)
        bumpRec(against, `${q}|${p}`, !aWon)
      }),
    )
  })
  return {
    pctOf: (id: string) => pct[id] ?? UNKNOWN_PLAYER_PCT,
    hasPct: (id: string) => id in pct,
    togetherOf: ((p: string, q: string) => together[[p, q].sort().join("|")]) as Lookup2,
    againstOf: ((p: string, q: string) => against[`${p}|${q}`]) as Lookup2,
  }
}

export interface RealMatchupModel {
  w: Features
  n: number
  looCorrect: number
  looN: number
  lookups: ReturnType<typeof realMatchupLookups>
}

let modelCache: RealMatchupModel | false | null = null

export function getRealMatchupModel(): RealMatchupModel | null {
  if (modelCache !== null) return modelCache || null
  const rows = buildRealMatchupRows()
  if (rows.length < REAL_MATCHUP_MIN_GAMES) {
    modelCache = false
    return null
  }
  const w = fitRealMatchupWeights(rows)
  let looCorrect = 0
  let looN = 0
  rows.forEach((r, i) => {
    // Starting from the full fit: dropping one game barely moves the answer, so a short refit
    // lands in the same place as a from-scratch one at a fraction of the cost.
    const wi = fitRealMatchupWeights(rows.filter((_, j) => j !== i), w, 150)
    const p = sigmoid(wi[0] * r.x[0] + wi[1] * r.x[1] + wi[2] * r.x[2])
    if (p === 0.5) return
    looN++
    if (p > 0.5 === (r.y === 1)) looCorrect++
  })
  modelCache = { w, n: rows.length, looCorrect, looN, lookups: realMatchupLookups() }
  return modelCache
}

export interface MatchupPrediction {
  pA: number
  factors: { label: string; lean: number }[]
  unranked: string[]
  model: RealMatchupModel
}

// Team A's chance to win, plus how much each input leans the game on its own (in percentage
// points above 50, positive toward A). null until there are enough real games to train on.
export function predictRealMatchup(teamA: string[], teamB: string[]): MatchupPrediction | null {
  const model = getRealMatchupModel()
  if (!model || teamA.length === 0 || teamB.length === 0) return null
  const L = model.lookups
  const x = realMatchupFeatures(teamA, teamB, L.pctOf, L.togetherOf, L.againstOf)
  const pA = sigmoid(PREGAME_SHRINK * (model.w[0] * x[0] + model.w[1] * x[1] + model.w[2] * x[2]))
  const factors = x.map((v, k) => ({
    label: REAL_MATCHUP_FACTOR_LABELS[k],
    lean: (sigmoid(PREGAME_SHRINK * model.w[k] * v) - 0.5) * 100,
  }))
  const unranked = [...teamA, ...teamB].filter((id) => !L.hasPct(id))
  return { pA, factors, unranked, model }
}

// Honest accuracy: each night is called from only the games played before it (never from later ones).
export function realMatchupAccuracyText(_model?: RealMatchupModel): string {
  const t = computeRealMatchupTrackRecord().total
  return t.called
    ? `Calling each night from only the games before it, it picked the winner in ${t.correct} of ${t.called} (${Math.round((t.correct / t.called) * 100)}%). Treat it as a lean, not a lock.`
    : ""
}

// For a lopsided matchup (odds more than 5 points from 50/50), the single trade of one player
// from each side that brings the odds closest to even. null when no trade helps by 2+ points.
export function bestEvenSwap(teamA: string[], teamB: string[]) {
  const now = predictRealMatchup(teamA, teamB)
  if (!now) return null
  const gapNow = Math.abs(now.pA - 0.5)
  if (gapNow <= 0.05) return null
  let best: { a: string; b: string; pA: number; gap: number } | null = null
  teamA.forEach((a) =>
    teamB.forEach((b) => {
      const newA = teamA.map((id) => (id === a ? b : id))
      const newB = teamB.map((id) => (id === b ? a : id))
      const p = predictRealMatchup(newA, newB)!.pA
      const gap = Math.abs(p - 0.5)
      if (!best || gap < best.gap) best = { a, b, pA: p, gap }
    }),
  )
  const b = best as { a: string; b: string; pA: number; gap: number } | null
  return b && gapNow - b.gap >= 0.02 ? b : null
}

// Track record: before each party night, refit on only the games played before it and call that
// night's games. Nights before it has REAL_MATCHUP_MIN_GAMES to learn from are skipped.
export interface TrackRecord {
  nights: { date: string; correct: number; called: number }[]
  total: { correct: number; called: number }
  early: { correct: number; called: number }
  late: { correct: number; called: number }
}

let trackCache: TrackRecord | null = null
export function computeRealMatchupTrackRecord(): TrackRecord {
  if (trackCache) return trackCache
  const rows = buildRealMatchupRows()
  const games = realSeasonsInOrder().flatMap((season) => [...season.games].sort(byPlayOrder))
  const nights: TrackRecord["nights"] = []
  let i = 0
  while (i < games.length) {
    let j = i
    while (j < games.length && games[j].date === games[i].date) j++
    if (i >= REAL_MATCHUP_MIN_GAMES) {
      const w = fitRealMatchupWeights(rows.slice(0, i))
      let correct = 0
      let called = 0
      for (let k = i; k < j; k++) {
        const p = sigmoid(w[0] * rows[k].x[0] + w[1] * rows[k].x[1] + w[2] * rows[k].x[2])
        if (p === 0.5) continue
        called++
        if (p > 0.5 === (rows[k].y === 1)) correct++
      }
      nights.push({ date: games[i].date, correct, called })
    }
    i = j
  }
  const sum = (list: TrackRecord["nights"]) =>
    list.reduce((acc, n) => ({ correct: acc.correct + n.correct, called: acc.called + n.called }), {
      correct: 0,
      called: 0,
    })
  const half = Math.floor(nights.length / 2)
  trackCache = { nights, total: sum(nights), early: sum(nights.slice(0, half)), late: sum(nights.slice(half)) }
  return trackCache
}

// Backtest for this app's own games: each one is called by a model fitted on only the games before it (the imported
// history plus earlier games here), with the same shrink the live odds use. These calls were not saved in advance, so
// they are shown apart from picks that were. Empty until the model has enough games to learn from.
let backtestCache: Map<string, number> | null = null
export function backtestAppGames(): Map<string, number> {
  if (backtestCache) return backtestCache
  const out = new Map<string, number>()
  backtestCache = out
  if (appGames.length === 0) return out
  const rows = buildRealMatchupRows()
  const first = rows.length - appGames.length
  let w: Features = [0, 0, 0]
  for (let k = 0; k < appGames.length; k++) {
    const i = first + k
    if (i < REAL_MATCHUP_MIN_GAMES) continue
    // Starting from the previous fit, a short refit lands where a full one would.
    w = fitRealMatchupWeights(rows.slice(0, i), w, w[0] === 0 && w[1] === 0 && w[2] === 0 ? 1500 : 300)
    const x = rows[i].x
    out.set(appGameIds[k], sigmoid(PREGAME_SHRINK * (w[0] * x[0] + w[1] * x[1] + w[2] * x[2])))
  }
  return out
}

// The same backtest for the imported games (most of the league's history lives there): each night is called by a model
// fitted on only the nights before it. Keyed by date and the two rosters, so a game in the app can be matched to it.
let realBacktestCache: Map<string, number> | null = null
const gameKey = (date: string, a: string[], b: string[]) => `${date}|${[...a].sort().join(",")}|${[...b].sort().join(",")}`
function realBacktest(): Map<string, number> {
  if (realBacktestCache) return realBacktestCache
  const out = new Map<string, number>()
  realBacktestCache = out
  const rows = buildRealMatchupRows()
  const games = realSeasonsInOrder().flatMap((season) => [...season.games].sort(byPlayOrder))
  let w: Features = [0, 0, 0]
  let i = 0
  while (i < games.length) {
    let j = i
    while (j < games.length && games[j].date === games[i].date) j++
    if (i >= REAL_MATCHUP_MIN_GAMES) {
      w = fitRealMatchupWeights(rows.slice(0, i), w, w[0] === 0 && w[1] === 0 && w[2] === 0 ? 1500 : 300)
      for (let k = i; k < j; k++) {
        const x = rows[k].x
        out.set(gameKey(games[k].date, games[k].a, games[k].b), sigmoid(PREGAME_SHRINK * (w[0] * x[0] + w[1] * x[1] + w[2] * x[2])))
      }
    }
    i = j
  }
  return out
}

// Team A's backtest chance for a game already played: from the app's own games, or the imported history matched by
// date and rosters (either side as team A). undefined when the model had too little to go on.
export function backtestPick(g: Game): number | undefined {
  const byId = backtestAppGames().get(g.id)
  if (byId !== undefined) return byId
  const real = realBacktest()
  const direct = real.get(gameKey(g.date, g.teamA, g.teamB))
  if (direct !== undefined) return direct
  const flipped = real.get(gameKey(g.date, g.teamB, g.teamA))
  return flipped === undefined ? undefined : 1 - flipped
}

// ---------- Balance Teams: win chances ----------
// Each team's chance to win. Two teams play one game, so the two chances sum to 100%. With three
// or more teams, each team's number is its average chance against every other team in the split.
export function predictTeamWinChances(teams: string[][]): number[] | null {
  if (teams.length < 2 || !getRealMatchupModel()) return null
  const vs: number[][] = teams.map(() => [])
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const p = predictRealMatchup(teams[i], teams[j])!.pA
      vs[i].push(p)
      vs[j].push(1 - p)
    }
  }
  return vs.map((v) => v.reduce((a, b) => a + b, 0) / v.length)
}

// How far the least even pairing in a split sits from 50/50, in percentage points.
export function worstPairingGap(teams: string[][]): number {
  let worst = 0
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      worst = Math.max(worst, Math.abs(predictRealMatchup(teams[i], teams[j])!.pA - 0.5) * 100)
    }
  }
  return worst
}
