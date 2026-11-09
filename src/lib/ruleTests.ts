import { CLEAR_Z, compareMeans, compareRates, HINT_Z, leagueFlow, pct, type Mean, type Rate } from "@/lib/gameFlow"
import { allResults, oldGames } from "@/lib/hallOfFame"
import { games, partsOf, yardstick } from "@/lib/insight"
import { correlate } from "@/lib/bodyEffort"
import type { RealGame } from "@/lib/real"
import { sequences } from "@/lib/sequences"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"
import { fit, gameKey, results } from "@/lib/winImpact"

// Well-known rules from other sports, checked against this league. About 15 are tested at once, so the bar for a verdict
// is high, and a rule needs a real sample before it can even be called "no sign of it".
export type RuleVerdict = "holds" | "backwards" | "none" | "early" | "suspect"
export const RULE_LABEL: Record<RuleVerdict, string> = { holds: "Holds up", backwards: "Backwards", none: "No sign of it", early: "Too early", suspect: "Data problem" }
export interface Rule {
  id: string
  sport: string
  claim: string
  numbers: string
  n: string
  verdict: RuleVerdict
  strength: "clear" | "hint" | null
  advice?: string // only when the evidence is good enough to act on
  note?: string
}
export type PickMethod = "balanced" | "captains" | "random" | "runback"

const CLEAR_P = 0.005
const HINT_P = 0.02
const MIN_WINS_N = 10
const NONE_WINS_N = 30
const NONE_SHOTS = 100
const CLOSE = 30 // same band edges as playerIdentity
const DEEP = 80
const SEQ_MIN_GAMES = 100 // games before a rating system can be compared, as in scripts/compare-models.mjs
const RANDOM_MIN = 15

const pc = (r: Rate) => (r.att ? `${Math.round(pct(r)!)}%` : "-")
const count = (r: Rate) => `${r.made}/${r.att}`
const rate = (): Rate => ({ made: 0, att: 0 })
const addRate = (r: Rate, made: boolean) => {
  r.att++
  if (made) r.made++
}
const madeOf = (e: ScoringEvent) => e.made !== false
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// Two-sided exact test against a coin flip.
export function coinP(wins: number, n: number): number {
  if (n === 0) return 1
  const logFact = (k: number) => {
    let s = 0
    for (let i = 2; i <= k; i++) s += Math.log(i)
    return s
  }
  const prob = (k: number) => Math.exp(logFact(n) - logFact(k) - logFact(n - k) - n * Math.log(2))
  const me = prob(wins)
  let p = 0
  for (let k = 0; k <= n; k++) if (prob(k) <= me * (1 + 1e-9)) p += prob(k)
  return Math.min(1, p)
}

export function verdictFromWins(wins: number, n: number): Pick<Rule, "verdict" | "strength"> {
  if (n < MIN_WINS_N) return { verdict: "early", strength: null }
  const p = coinP(wins, n)
  const strength = p < CLEAR_P ? "clear" : p < HINT_P ? "hint" : null
  if (strength) return { verdict: wins * 2 > n ? "holds" : "backwards", strength }
  return { verdict: n >= NONE_WINS_N ? "none" : "early", strength: null }
}

const fromCompare = (v: "clear" | "hint" | "early", diff: number | null, sizes: number): Pick<Rule, "verdict" | "strength"> => {
  if (diff !== null && v !== "early") return { verdict: diff > 0 ? "holds" : "backwards", strength: v }
  return { verdict: diff !== null && sizes >= NONE_SHOTS ? "none" : "early", strength: null }
}

// a against b within groups, so a difference in the mix of groups cannot create the result. Positive means a is higher.
export function stratified(groups: [Rate, Rate][]): { diff: number | null; z: number | null; verdict: "clear" | "hint" | "early" } {
  let sum = 0
  let weight = 0
  let variance = 0
  for (const [a, b] of groups) {
    if (a.att === 0 || b.att === 0) continue
    const w = (a.att * b.att) / (a.att + b.att)
    const p = (a.made + b.made) / (a.att + b.att)
    sum += w * (a.made / a.att - b.made / b.att)
    weight += w
    variance += w * p * (1 - p)
  }
  if (weight === 0 || variance === 0) return { diff: null, z: null, verdict: "early" }
  const z = sum / Math.sqrt(variance)
  return { diff: (sum / weight) * 100, z, verdict: Math.abs(z) >= CLEAR_Z ? "clear" : Math.abs(z) >= HINT_Z ? "hint" : "early" }
}

function zoneOf(e: ScoringEvent): string {
  if (!e.shotLocation) return "?"
  const d = Math.hypot(e.shotLocation.x - 50, e.shotLocation.y)
  return e.points === 3 ? (d > DEEP ? "deep" : "arc") : d > CLOSE ? "mid" : "close"
}
const passed = (e: ScoringEvent) => !!e.passerId && e.passerId !== "none" && e.passerId !== e.scorerId

function splitByZone(shots: ScoringEvent[], isA: (e: ScoringEvent) => boolean) {
  const by = new Map<string, [Rate, Rate]>()
  const a = rate()
  const b = rate()
  for (const e of shots) {
    if (zoneOf(e) === "?") continue
    const g = by.get(zoneOf(e)) ?? by.set(zoneOf(e), [rate(), rate()]).get(zoneOf(e))!
    addRate(g[isA(e) ? 0 : 1], madeOf(e))
    addRate(isA(e) ? a : b, madeOf(e))
  }
  return { groups: [...by.values()], a, b }
}

const pointsMean = (shots: ScoringEvent[]): Mean => {
  const m: Mean = { sum: 0, sq: 0, n: 0 }
  for (const e of shots) {
    const v = madeOf(e) ? e.points : 0
    m.sum += v
    m.sq += v * v
    m.n++
  }
  return m
}

// What a player's twos and threes are each worth, for the Deep dive tab.
export function shotValue(state: PooleanState, id?: string) {
  const all = games(state).flatMap((g) => g.scoringEvents).filter((e) => !id || e.scorerId === id)
  const of = (p: number) => {
    const m = pointsMean(all.filter((e) => e.points === p))
    return { att: m.n, perShot: m.n ? m.sum / m.n : null }
  }
  return { two: of(2), three: of(3) }
}

// The teams that played, in order, with how each result fits a rule.
function resultRules(state: PooleanState, old: RealGame[]): Rule[] {
  const played = allResults(state, old)
  let bigW = 0
  let bigN = 0
  let freshW = 0
  let freshN = 0
  let chemW = 0
  let chemN = 0
  let againW = 0
  let againN = 0
  const together = new Map<string, number>()
  const pair = (x: string, y: string) => [x, y].sort().join("|")
  const links = (t: string[]) => t.flatMap((x, i) => t.slice(i + 1).map((y) => together.get(pair(x, y)) ?? 0))
  const avg = (xs: number[]) => (xs.length ? mean(xs) : 0)
  let prev: (typeof played)[number] | null = null
  const teamKey = (t: string[]) => [...t].sort().join()
  for (const g of played) {
    if (g.won.length !== g.lost.length) {
      bigN++
      if (g.won.length > g.lost.length) bigW++
    }
    if (prev && prev.date === g.date) {
      const sat = new Set([...prev.won, ...prev.lost])
      const fresh = (t: string[]) => t.filter((p) => !sat.has(p)).length / t.length
      if (fresh(g.won) !== fresh(g.lost)) {
        freshN++
        if (fresh(g.won) > fresh(g.lost)) freshW++
      }
      const same = [teamKey(g.won), teamKey(g.lost)].sort().join("/") === [teamKey(prev.won), teamKey(prev.lost)].sort().join("/")
      if (same) {
        againN++
        if (teamKey(g.won) === teamKey(prev.won)) againW++
      }
    }
    const [cw, cl] = [avg(links(g.won)), avg(links(g.lost))]
    if (cw !== cl && g.won.length > 1 && g.lost.length > 1) {
      chemN++
      if (cw > cl) chemW++
    }
    for (const t of [g.won, g.lost]) t.forEach((x, i) => t.slice(i + 1).forEach((y) => together.set(pair(x, y), (together.get(pair(x, y)) ?? 0) + 1)))
    prev = g
  }

  // Each game predicted from the games before it: a chess rating against a plain shrunk win rate.
  const elo = new Map<string, number>()
  const rec = new Map<string, [number, number]>()
  let eloLoss = 0
  let rateLoss = 0
  const loss = (p: number) => -Math.log(Math.max(1e-9, p))
  for (const g of played) {
    const r = (t: string[]) => mean(t.map((p) => elo.get(p) ?? 1500))
    const wr = (t: string[]) => mean(t.map((p) => ((rec.get(p)?.[0] ?? 0) + 2.5) / ((rec.get(p)?.[1] ?? 0) + 5)))
    const ew = 1 / (1 + 10 ** ((r(g.lost) - r(g.won)) / 400))
    eloLoss += loss(ew)
    rateLoss += loss(1 / (1 + Math.exp(-5 * (wr(g.won) - wr(g.lost)))))
    const d = 32 * (1 - ew)
    g.won.forEach((p) => {
      elo.set(p, (elo.get(p) ?? 1500) + d / g.won.length)
      const c = rec.get(p) ?? [0, 0]
      rec.set(p, [c[0] + 1, c[1] + 1])
    })
    g.lost.forEach((p) => {
      elo.set(p, (elo.get(p) ?? 1500) - d / g.lost.length)
      const c = rec.get(p) ?? [0, 0]
      rec.set(p, [c[0], c[1] + 1])
    })
  }
  const n = played.length || 1
  const eloBeats = eloLoss / n < rateLoss / n - 0.01

  // Players above .500 in the first half of the season tend to come back toward it.
  const dates = [...new Set(played.map((g) => g.date))]
  const cut = dates[Math.floor(dates.length / 2)]
  const halves = new Map<string, [Rate, Rate]>()
  for (const g of played) {
    for (const [t, won] of [[g.won, true], [g.lost, false]] as const) {
      for (const p of t) {
        const h = halves.get(p) ?? halves.set(p, [rate(), rate()]).get(p)!
        addRate(h[g.date < cut ? 0 : 1], won)
      }
    }
  }
  const hot = [...halves.values()].filter(([a, b]) => a.att >= 5 && b.att >= 5 && a.made / a.att > 0.5)
  const cooled = hot.filter(([a, b]) => b.made / b.att < a.made / a.att).length

  return [
    {
      id: "power-play",
      sport: "Hockey",
      claim: "The team with an extra player wins",
      numbers: `Bigger team won ${bigW} of ${bigN}`,
      n: `${bigN} uneven games`,
      ...verdictFromWins(bigW, bigN),
      advice: "When teams are uneven, the bigger team has really won more. Balance the talent to make up for it.",
    },
    { id: "fresh-legs", sport: "Basketball and soccer", claim: "Fresher legs beat a team that just played", numbers: `Fresher team won ${freshW} of ${freshN}`, n: `${freshN} games`, ...verdictFromWins(freshW, freshN), advice: "Rest shows up on the scoreboard, so rotate who sits." },
    { id: "chemistry", sport: "Soccer", claim: "Teams that have played together more win", numbers: `More experienced team won ${chemW} of ${chemN}`, n: `${chemN} games`, ...verdictFromWins(chemW, chemN), advice: "Time together is paying off, so keep some pairs together." },
    { id: "rematch", sport: "Playoff series", claim: "The winner wins the immediate rematch", numbers: `Same winner ${againW} of ${againN}`, n: `${againN} rematches`, ...verdictFromWins(againW, againN), advice: "The same team tends to win a rematch, so shuffle teams instead of running it back." },
    {
      id: "elo",
      sport: "Chess",
      claim: "An Elo rating predicts better than win rate",
      numbers: `Elo ${(eloLoss / n).toFixed(3)} against win rate ${(rateLoss / n).toFixed(3)}, lower is better`,
      n: `${played.length} games`,
      verdict: played.length < SEQ_MIN_GAMES ? "early" : eloBeats ? "holds" : "none",
      strength: null,
    },
    { id: "regression", sport: "Baseball", claim: "A hot start cools off toward average", numbers: `${cooled} of ${hot.length} players above .500 early did worse later`, n: `${hot.length} players`, ...verdictFromWins(cooled, hot.length) },
  ]
}

function firstAndHalf(gs: Game[]) {
  let firstW = 0
  let halfW = 0
  let halfN = 0
  let n = 0
  for (const g of gs) {
    const ev = g.scoringEvents.filter(madeOf).sort((a, b) => (a.videoTime ?? 0) - (b.videoTime ?? 0))
    const side = (e: ScoringEvent) => (g.teamA.includes(e.scorerId) ? 0 : 1)
    const add = (xs: ScoringEvent[]) => xs.reduce<[number, number]>((s, e) => (side(e) ? [s[0], s[1] + e.points] : [s[0] + e.points, s[1]]), [0, 0])
    const f = add(ev)
    const w = f[0] > f[1] ? 0 : 1
    if (ev.length === 0) continue
    n++
    if (side(ev[0]) === w) firstW++
    const h = add(ev.slice(0, Math.floor(ev.length / 2)))
    if (h[0] !== h[1]) {
      halfN++
      if ((h[0] > h[1] ? 0 : 1) === w) halfW++
    }
  }
  return { firstW, n, halfW, halfN }
}

function shotRules(state: PooleanState): Rule[] {
  const gs = games(state)
  const shots = gs.flatMap((g) => g.scoringEvents)
  const twos = pointsMean(shots.filter((e) => e.points === 2))
  const threes = pointsMean(shots.filter((e) => e.points === 3))
  const moreyDiff = compareMeans(twos, threes)
  const per = (m: Mean) => (m.n ? (m.sum / m.n).toFixed(2) : "-")
  const breakEven = twos.n ? Math.round(((twos.sum / twos.n) / 3) * 100) : 0
  const threeRate = threes.n ? Math.round(((threes.sum / threes.n) / 3) * 100) : 0

  const open = splitByZone(shots, (e) => e.contestLevel === "none")
  const openS = stratified(open.groups)
  // If defenders get tagged more often on makes than misses, "guarded" partly means "went in", and this comparison says
  // nothing about being open.
  const guardedWhenMade: Rate = { made: shots.filter((e) => madeOf(e) && e.contestLevel !== "none").length, att: shots.filter(madeOf).length }
  const guardedWhenMissed: Rate = { made: shots.filter((e) => !madeOf(e) && e.contestLevel !== "none").length, att: shots.filter((e) => !madeOf(e)).length }
  const taggingBias = compareRates(guardedWhenMissed, guardedWhenMade)
  const suspect = taggingBias.verdict !== "early"
  const pass = splitByZone(shots, passed)
  const passS = stratified(pass.groups)

  const seq = sequences(state).league
  const transition = compareRates(seq.settled, seq.offTurnover)
  const putback = compareRates(seq.settled, seq.putback)
  const hot = leagueFlow(state).hot
  const streak = compareRates(hot.afterMiss, hot.afterMake)

  const expect = yardstick(gs)
  let shootW = 0
  let shootN = 0
  let tovW = 0
  let tovN = 0
  for (const g of gs) {
    const p = partsOf(g, expect)
    if (!p) continue
    const view = p.margin > 0 ? 1 : -1
    const sh = (p.parts.quality + p.parts.making) * view
    const to = p.parts.turnovers * view
    if (sh !== 0) {
      shootN++
      if (sh > 0) shootW++
    }
    if (to !== 0) {
      tovN++
      if (to > 0) tovW++
    }
  }
  const { firstW, n, halfW, halfN } = firstAndHalf(gs)

  return [
    {
      id: "moreyball",
      sport: "NBA",
      claim: "Threes are worth more than twos",
      numbers: `Twos ${per(twos)} points a shot, threes ${per(threes)}`,
      n: `${twos.n + threes.n} shots`,
      ...fromCompare(moreyDiff.verdict, moreyDiff.diff, Math.min(twos.n, threes.n)),
      advice: `Twos are worth ${per(twos)} a shot and threes ${per(threes)}. A three has to go in ${breakEven}% of the time to match a two, and they go in ${threeRate}%. Take fewer threes.`,
    },
    {
      id: "open-shots",
      sport: "Every sport",
      claim: "An open shot beats a guarded one from the same spot",
      numbers: `Open ${pc(open.a)}, guarded ${pc(open.b)}${openS.diff !== null ? `, ${openS.diff > 0 ? "+" : ""}${Math.round(openS.diff)} points from the same zone` : ""}`,
      n: `${open.a.att + open.b.att} shots`,
      ...(suspect ? { verdict: "suspect" as const, strength: null } : fromCompare(openS.verdict, openS.diff, Math.min(open.a.att, open.b.att))),
      note: suspect ? `A defender is tagged on ${pc(guardedWhenMade)} of makes but ${pc(guardedWhenMissed)} of misses, so the tag may depend on whether the shot went in.` : undefined,
      advice: openS.diff !== null && openS.diff > 0 ? "Getting open is worth it from the same spot. Move without the ball." : undefined,
    },
    {
      id: "extra-pass",
      sport: "Basketball",
      claim: "A shot off a pass beats one you got yourself",
      numbers: `Off a pass ${pc(pass.a)}, on their own ${pc(pass.b)}${passS.diff !== null ? `, ${passS.diff > 0 ? "+" : ""}${Math.round(passS.diff)} points from the same zone` : ""}`,
      n: `${pass.a.att + pass.b.att} shots`,
      ...fromCompare(passS.verdict, passS.diff, Math.min(pass.a.att, pass.b.att)),
      advice: passS.diff !== null && passS.diff > 0 ? "Passing is creating better shots from the same spot. Make the extra pass." : "Passing is not creating better shots from the same spot. Do not pass just to pass.",
    },
    { id: "transition", sport: "Basketball", claim: "Run after a turnover, before the defense sets", numbers: `Off a turnover ${pc(seq.offTurnover)} (${count(seq.offTurnover)}), settled ${pc(seq.settled)} (${count(seq.settled)})`, n: `${seq.offTurnover.att + seq.settled.att} shots`, ...fromCompare(transition.verdict, transition.diff, Math.min(seq.offTurnover.att, seq.settled.att)), advice: "Shots right after a turnover go in more often. Push before the defense is back." },
    { id: "putbacks", sport: "Basketball", claim: "Second-chance shots are the best shots", numbers: `Putbacks ${pc(seq.putback)} (${count(seq.putback)}), settled ${pc(seq.settled)} (${count(seq.settled)})`, n: `${seq.putback.att + seq.settled.att} shots`, ...fromCompare(putback.verdict, putback.diff, Math.min(seq.putback.att, seq.settled.att)), advice: `Putbacks go in ${pc(seq.putback)} against ${pc(seq.settled)} for settled shots. Crash the glass.` },
    { id: "hot-hand", sport: "Basketball", claim: "A make makes the next shot more likely", numbers: `After a make ${pc(hot.afterMake)}, after a miss ${pc(hot.afterMiss)}`, n: `${hot.afterMake.att + hot.afterMiss.att} shots`, ...fromCompare(streak.verdict, streak.diff, Math.min(hot.afterMake.att, hot.afterMiss.att)), advice: "Shooters really do stay hot. Feed whoever just hit." },
    { id: "four-factors", sport: "NBA", claim: "The better shooting team wins", numbers: `Better shooting team won ${shootW} of ${shootN}`, n: `${shootN} games`, ...verdictFromWins(shootW, shootN), advice: "Shooting decides games here, so shot choice matters more than anything else." },
    { id: "ball-security", sport: "Football", claim: "Win the turnover battle, win the game", numbers: `Team with fewer live turnovers won ${tovW} of ${tovN}`, n: `${tovN} games`, ...verdictFromWins(tovW, tovN), advice: "Holding on to the ball decides games. Cut the risky passes." },
    { id: "halftime", sport: "Soccer", claim: "The leader at halfway wins", numbers: `Halfway leader won ${halfW} of ${halfN}`, n: `${halfN} games`, ...verdictFromWins(halfW, halfN) },
    { id: "first-score", sport: "Soccer", claim: "Whoever scores first wins", numbers: `First to score won ${firstW} of ${n}`, n: `${n} games`, ...verdictFromWins(firstW, n), advice: "The first basket matters. Come out with a real play." },
  ]
}

// How each game's teams were picked: what was logged on the game, or the backfill for old-site games. A rematch of the
// previous game counts as a runback without anyone saying so.
export function picksByResult(state: PooleanState): Map<string, PickMethod> {
  const out = new Map<string, PickMethod>()
  for (const [k, v] of Object.entries((state.oldGamePicks ?? {}) as Record<string, PickMethod>)) out.set(k, v)
  for (const g of state.games) if (g.teamsPickedBy) out.set(gameKey(g.date, g.teamA, g.teamB), g.teamsPickedBy)
  return out
}

function pickRules(state: PooleanState, old: RealGame[]): Rule[] {
  const picks = picksByResult(state)
  const all = results(state, old)
  const margins: Record<"balanced" | "other", Mean> = { balanced: { sum: 0, sq: 0, n: 0 }, other: { sum: 0, sq: 0, n: 0 } }
  for (const g of games(state)) {
    const p = picks.get(gameKey(g.date, g.teamA, g.teamB))
    if (!p) continue
    const v = Math.abs(partsOf(g, () => 0)?.margin ?? 0)
    const m = margins[p === "balanced" ? "balanced" : "other"]
    m.sum += v
    m.sq += v * v
    m.n++
  }
  const c = compareMeans(margins.balanced, margins.other)
  // A rematch shares its key with the game before, but it was not a fresh random draw.
  const isRematch = (i: number) => i > 0 && all[i - 1].night === all[i].night && gameKey(all[i - 1].night, all[i - 1].a, all[i - 1].b) === gameKey(all[i].night, all[i].a, all[i].b)
  const random = all.filter((r, i) => !isRematch(i) && picks.get(gameKey(r.night, r.a, r.b)) === "random")
  const rows: Rule[] = [
    {
      id: "balance",
      sport: "Fantasy drafts",
      claim: "Balanced teams play closer games",
      numbers: margins.balanced.n && margins.other.n ? `Balanced games decided by ${(margins.balanced.sum / margins.balanced.n).toFixed(1)}, others by ${(margins.other.sum / margins.other.n).toFixed(1)}` : "Needs games tagged with how teams were picked",
      n: `${margins.balanced.n + margins.other.n} tagged games`,
      ...fromCompare(c.verdict, c.diff, Math.min(margins.balanced.n, margins.other.n)),
    },
  ]
  // Random teams are the nearest thing to an experiment: nobody chose who plays with whom.
  let numbers = `${random.length} of ${RANDOM_MIN} random-team games tagged`
  let verdict: Pick<Rule, "verdict" | "strength"> = { verdict: "early", strength: null }
  if (random.length >= RANDOM_MIN) {
    const [f, r] = [fit(all), fit(random)]
    const ids = [...r.w.keys()].filter((id) => f.w.has(id))
    const link = correlate(ids.map((id) => f.w.get(id)!), ids.map((id) => r.w.get(id)!))
    numbers = `Win impact from random games against all games: ${link.rho === null ? "-" : link.rho.toFixed(2)} agreement`
    verdict = link.sure === "early" ? { verdict: "early", strength: null } : { verdict: (link.rho ?? 0) > 0 ? "holds" : "backwards", strength: link.sure }
  }
  rows.push({ id: "random-teams", sport: "Clinical trials", claim: "Player value holds up when teams are random", numbers, n: `${random.length} random games`, ...verdict })
  return rows
}

export function ruleTests(state: PooleanState, old: RealGame[] = oldGames()): Rule[] {
  return [...shotRules(state), ...resultRules(state, old), ...pickRules(state, old)]
}

// What the evidence supports doing differently. Only rules with a real verdict get a say.
export const adviceFrom = (rules: Rule[]) => rules.filter((r) => r.advice && r.strength && (r.verdict === "holds" || r.verdict === "backwards"))
