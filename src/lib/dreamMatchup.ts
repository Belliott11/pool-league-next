import { filmedGames } from "@/lib/filmed"
import { DEFAULT_TARGET, PREGAME_WEIGHT_LIVE } from "@/lib/live"
import { ballRates, gapFor, winProbabilityWithBall, type BallRates } from "@/lib/liveBall"
import { predictRealMatchup } from "@/lib/matchup"
import { gameOver } from "@/lib/race"
import type { PooleanState } from "@/lib/types"

// Dream matchup (page #/games/dream/<a,b,c>.<d,e>; player ids have hyphens, never dots): any two teams from the roster. The chance is the live odds at the tip (liveBall.ts):
// the pre-game read (predictRealMatchup, the old site's results) at the live weight, raced by trips with the ball at the league's trip
// rates, first to the usual target, win by 2. Then one game played out trip by trip with a seeded random draw: each trip scores at the
// team's rate (set so the chance at the tip matches), a 2 or a 3 at the league's mix, the scorer drawn by each player's own makes of that
// kind a game, and a pass by the league's share of assisted baskets and each teammate's assists a game. Players' rates lean on the league
// average by LEAN games, so a newcomer is an average player rather than a blank.

export const LEAN = 3

export interface Profile {
  id: string
  games: number
  twos: number // made 2s a game, leaned
  threes: number
  assists: number
}

export interface Line {
  id: string
  points: number
  threes: number
  assists: number
}

export interface DreamPlay {
  side: "A" | "B"
  scorer: string
  passer: string | null
  points: 2 | 3
  a: number
  b: number
  lead: boolean // took the lead
}

export interface DreamGame {
  a: number
  b: number
  lines: Line[]
  plays: DreamPlay[]
  leadChanges: number
}

export interface Dream {
  target: number
  read: number | null // the pre-game read's own number for Team A, before the live weight
  chance: number // Team A's chance at the tip
  factors: { label: string; lean: number }[]
  game: DreamGame
}

// Each player's makes and assists a game over the filmed games, leaned on the league average.
export function profiles(state: PooleanState): Map<string, Profile> {
  const games = filmedGames(state)
  const per = new Map<string, { g: number; t2: number; t3: number; ast: number }>()
  for (const g of games) {
    for (const id of [...g.teamA, ...g.teamB]) {
      const v = per.get(id) ?? per.set(id, { g: 0, t2: 0, t3: 0, ast: 0 }).get(id)!
      v.g++
    }
    for (const e of g.scoringEvents) {
      if (e.made === false || e.points === 1) continue
      const s = per.get(e.scorerId)
      if (s) e.points === 3 ? s.t3++ : s.t2++
      const a = e.assistId && e.assistId !== e.scorerId ? per.get(e.assistId) : undefined
      if (a) a.ast++
    }
  }
  let G = 0, T2 = 0, T3 = 0, AST = 0
  for (const v of per.values()) (G += v.g), (T2 += v.t2), (T3 += v.t3), (AST += v.ast)
  const avg = { t2: G ? T2 / G : 2, t3: G ? T3 / G : 0.4, ast: G ? AST / G : 1 }
  const out = new Map<string, Profile>()
  for (const p of state.players) {
    const v = per.get(p.id) ?? { g: 0, t2: 0, t3: 0, ast: 0 }
    const lean = (x: number, m: number) => (x + LEAN * m) / (v.g + LEAN)
    out.set(p.id, { id: p.id, games: v.g, twos: lean(v.t2, avg.t2), threes: lean(v.t3, avg.t3), assists: lean(v.ast, avg.ast) })
  }
  return out
}

// The league's share of made baskets that came off a pass.
function assistedShare(state: PooleanState): number {
  let made = 0, ast = 0
  for (const g of filmedGames(state))
    for (const e of g.scoringEvents)
      if (e.made !== false && e.points !== 1) {
        made++
        if (e.assistId && e.assistId !== e.scorerId) ast++
      }
  return made ? ast / made : 0.4
}

// A small seeded random number source (mulberry32), so a matchup's game is the same on every phone until "Play it again".
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hash = (s: string) => {
  let h = 0x811c9dc5
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  return h
}

function pick<T>(items: T[], weight: (x: T) => number, r: number): T {
  const total = items.reduce((s, x) => s + Math.max(0.01, weight(x)), 0)
  let at = r * total
  for (const x of items) {
    at -= Math.max(0.01, weight(x))
    if (at <= 0) return x
  }
  return items[items.length - 1]
}

export function playGame(teamA: string[], teamB: string[], pA: number, pB: number, rates: BallRates, prof: Map<string, Profile>, assisted: number, target: number, seed: number): DreamGame {
  const rand = rng(seed)
  const lines = new Map<string, Line>([...teamA, ...teamB].map((id) => [id, { id, points: 0, threes: 0, assists: 0 }]))
  const plays: DreamPlay[] = []
  let a = 0, b = 0, leadChanges = 0
  let leader: "A" | "B" | null = null
  let ball: "A" | "B" = rand() < 0.5 ? "A" : "B"
  for (let trip = 0; trip < 2000 && !gameOver(a, b, target); trip++) {
    const team = ball === "A" ? teamA : teamB
    if (rand() < (ball === "A" ? pA : pB)) {
      const points: 2 | 3 = rand() < rates.share3 ? 3 : 2
      const scorer = pick(team, (id) => (points === 3 ? prof.get(id)?.threes : prof.get(id)?.twos) ?? 1, rand())
      const mates = team.filter((id) => id !== scorer)
      const passer = mates.length && rand() < assisted ? pick(mates, (id) => prof.get(id)?.assists ?? 1, rand()) : null
      if (ball === "A") a += points
      else b += points
      const l = lines.get(scorer)!
      l.points += points
      if (points === 3) l.threes++
      if (passer) lines.get(passer)!.assists++
      const now: "A" | "B" | null = a > b ? "A" : b > a ? "B" : leader
      const took = now !== leader && now !== null
      if (took && leader !== null) leadChanges++
      leader = now
      plays.push({ side: ball, scorer, passer, points, a, b, lead: took })
    }
    ball = ball === "A" ? "B" : "A"
  }
  return { a, b, lines: [...lines.values()], plays, leadChanges }
}

export function dreamMatchup(state: PooleanState, teamA: string[], teamB: string[], again = 0): Dream {
  const target = DEFAULT_TARGET
  const rates = ballRates(state)
  const pred = predictRealMatchup(teamA, teamB)
  const read = pred?.pA ?? null
  const chance = winProbabilityWithBall(0, 0, target, read, null, rates)
  // The same trip rates the chance uses, so the simulated games win about as often as it says.
  const pre = Math.min(0.97, Math.max(0.03, 0.5 + PREGAME_WEIGHT_LIVE * ((read ?? 0.5) - 0.5)))
  const gap = gapFor(target, pre, rates)
  const game = playGame(teamA, teamB, rates.p + gap, rates.p - gap, rates, profiles(state), assistedShare(state), target, hash(`${dreamKey(teamA, teamB)}|${again}`))
  return { target, read, chance, factors: pred?.factors ?? [], game }
}

// The address part for a matchup, and back.
export const dreamKey = (a: string[], b: string[]) => `${a.join(",")}.${b.join(",")}`
export function parseDreamKey(key: string, ids: Set<string>): [string[], string[]] {
  const [x = "", y = ""] = key.split(".")
  const side = (s: string) => [...new Set(s.split(",").filter((id) => ids.has(id)))]
  const a = side(x)
  return [a, side(y).filter((id) => !a.includes(id))]
}
