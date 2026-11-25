import { WIN_BY } from "@/lib/race"
import { sameMathRules } from "@/lib/rulebook"
import type { Game, PooleanState } from "@/lib/types"

// "Is a 3 worth it?" A shot is worth the win chance it leaves you with, counting what happens when it misses. A missed 3 goes out of
// bounds far more often than a missed 2 (a turnover, the other team's ball) and is rebounded by the shooting team less often, so a 3
// has to go in more than 2/3 as often as a 2 to be the better shot. The win chances come from a race to the target that knows who has
// the ball: each trip (turn with the ball, see possessions.ts) scores a 2 or a 3 at the league's rates, and the ball changes hands after
// every trip. Two even teams are assumed, so the answer is about the shot, not the matchup.

export const PRIOR_SHOTS = 15 // a player's rates lean on the league's as if they had this many more shots at the league's rates

export interface ShotKind {
  att: number
  made: number
  misses: number
  oob: number // misses ruled out of bounds: the other team's ball
  oreb: number // misses the shooting team got back
  lost: number // every other miss: rebounded by the defense, blocked or stolen
}

const blank = (): ShotKind => ({ att: 0, made: 0, misses: 0, oob: 0, oreb: 0, lost: 0 })
const filmed = (g: Game) => g.scoringEvents.length > 0 && !g.liveInProgress
// The league's rates come from the games under the newest scoring, possession and out-of-bounds rules (rulebook.ts), once they have
// enough games; a player's own shots count from every game.
function leagueGames(state: PooleanState): Game[] {
  const gs = state.games.filter(filmed)
  return sameMathRules(gs, gs.map((g) => g.date || "").sort().at(-1))
}

export function shotKinds(state: PooleanState, only?: string): { two: ShotKind; three: ShotKind } {
  const two = blank()
  const three = blank()
  for (const g of only ? state.games.filter(filmed) : leagueGames(state)) {
    const outOfBounds = new Set(g.turnoverEvents.map((t) => t.missEventId).filter(Boolean))
    const sideOf = (id: string) => (g.teamA.includes(id) ? "A" : g.teamB.includes(id) ? "B" : null)
    for (const e of g.scoringEvents) {
      if ((e.points !== 2 && e.points !== 3) || (only && e.scorerId !== only)) continue
      const k = e.points === 2 ? two : three
      k.att++
      if (e.made !== false) {
        k.made++
        continue
      }
      k.misses++
      if (outOfBounds.has(e.id)) k.oob++
      else if (!e.turnoverEventId && e.rebounderId && sideOf(e.rebounderId) === sideOf(e.scorerId)) k.oreb++
      else k.lost++
    }
  }
  return { two, three }
}

// How often a trip ends in a made 2 and a made 3, over every filmed game: trips are shots, less offensive rebounds, plus live-ball
// turnovers (the same count as possessions.ts). Free throws are rare and left out.
export function tripRates(state: PooleanState): { t2: number; t3: number; trips: number } {
  let trips = 0
  let m2 = 0
  let m3 = 0
  for (const g of leagueGames(state)) {
    const sideOf = (id: string) => (g.teamA.includes(id) ? "A" : g.teamB.includes(id) ? "B" : null)
    const onShot = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
    for (const e of g.scoringEvents) {
      if (e.points !== 2 && e.points !== 3) continue
      trips++
      if (e.made !== false) {
        if (e.points === 2) m2++
        else m3++
      } else if (e.rebounderId && !e.turnoverEventId && sideOf(e.rebounderId) === sideOf(e.scorerId)) trips--
    }
    for (const t of g.turnoverEvents) if (!t.missEventId && !onShot.has(t.id)) trips++
  }
  return trips ? { t2: m2 / trips, t3: m3 / trips, trips } : { t2: 0.3, t3: 0.05, trips: 0 }
}

// W(a, b, ours): the chance "we" win at a score of a (us) to b (them), with the ball ours or theirs, first to `target`, win by 2.
// Once both teams are within WIN_BY - 1 of the target only the margin matters, so those scores are folded together, and the whole
// table is solved by repeating the update until it settles (the win-by-2 margins feed each other in a loop).
export function possessionOdds(target: number, t2: number, t3: number): (a: number, b: number, ours: boolean) => number {
  const floor = target - WIN_BY + 1
  const fold = (a: number, b: number): [number, number] => {
    const m = Math.min(a, b)
    return m > floor ? [a - (m - floor), b - (m - floor)] : [a, b]
  }
  const over = (a: number, b: number) => (a >= target || b >= target) && Math.abs(a - b) >= WIN_BY
  const size = target + 4
  const idx = (a: number, b: number, o: number) => (a * size + b) * 2 + o
  const v = new Float64Array(size * size * 2).fill(0.5)
  const at = (x: number, y: number, o: number): number => {
    if (over(x, y)) return x > y ? 1 : 0
    const [a, b] = fold(x, y)
    return v[idx(a, b, o)]
  }
  const none = 1 - t2 - t3
  for (let it = 0; it < 4000; it++) {
    let moved = 0
    for (let a = size - 1; a >= 0; a--)
      for (let b = size - 1; b >= 0; b--) {
        if (over(a, b) || fold(a, b)[0] !== a || fold(a, b)[1] !== b) continue
        const ours = t2 * at(a + 2, b, 0) + t3 * at(a + 3, b, 0) + none * at(a, b, 0)
        const theirs = t2 * at(a, b + 2, 1) + t3 * at(a, b + 3, 1) + none * at(a, b, 1)
        moved = Math.max(moved, Math.abs(v[idx(a, b, 1)] - ours), Math.abs(v[idx(a, b, 0)] - theirs))
        v[idx(a, b, 1)] = ours
        v[idx(a, b, 0)] = theirs
      }
    if (moved < 1e-10) break
  }
  return (a, b, ours) => at(a, b, ours ? 1 : 0)
}

export interface Shooter {
  p2: number // chance a 2 goes in
  p3: number
  keep2: number // chance a missed 2 comes back to the shooting team
  keep3: number
  oob2: number // chance a missed 2 goes out of bounds
  oob3: number
}

// The win chance left after shooting a `points` shot at (a, b) with the ball, for a shooter who makes it with chance p and whose
// team gets the miss back with chance keep.
export function shotValue(W: ReturnType<typeof possessionOdds>, a: number, b: number, points: 2 | 3, p: number, keep: number): number {
  return p * W(a + points, b, false) + (1 - p) * (keep * W(a, b, true) + (1 - keep) * W(a, b, false))
}

// How often a 3 has to go in to be worth the same as this shooter's 2, at (a, b) with the ball. null when no make rate is enough.
export function breakEvenThree(W: ReturnType<typeof possessionOdds>, a: number, b: number, s: Shooter): number | null {
  const two = shotValue(W, a, b, 2, s.p2, s.keep2)
  const miss = s.keep3 * W(a, b, true) + (1 - s.keep3) * W(a, b, false)
  const make = W(a + 3, b, false)
  if (make - miss <= 1e-9) return null
  const p = (two - miss) / (make - miss)
  return p > 1 ? null : Math.max(0, p)
}

// The league as one shooter, and each player leaning on it by PRIOR_SHOTS.
export function leagueShooter(state: PooleanState): Shooter {
  const { two, three } = shotKinds(state)
  const r = (x: number, n: number, fallback: number) => (n ? x / n : fallback)
  return {
    p2: r(two.made, two.att, 0.4),
    p3: r(three.made, three.att, 0.2),
    keep2: r(two.oreb, two.misses, 0.25),
    keep3: r(three.oreb, three.misses, 0.12),
    oob2: r(two.oob, two.misses, 0.2),
    oob3: r(three.oob, three.misses, 0.4),
  }
}

export function playerShooter(state: PooleanState, id: string, league = leagueShooter(state)): Shooter & { two: ShotKind; three: ShotKind } {
  const { two, three } = shotKinds(state, id)
  const lean = (x: number, n: number, l: number) => (x + PRIOR_SHOTS * l) / (n + PRIOR_SHOTS)
  // Getting a miss back depends on teammates as much as the shooter, so only where the miss goes (out of bounds or not) is the
  // shooter's own: their in-bounds misses come back at the league's rate for that shot.
  const oob2 = lean(two.oob, two.misses, league.oob2)
  const oob3 = lean(three.oob, three.misses, league.oob3)
  const back = (keep: number, oob: number) => (oob < 1 ? keep / (1 - oob) : 0)
  return {
    two,
    three,
    p2: lean(two.made, two.att, league.p2),
    p3: lean(three.made, three.att, league.p3),
    oob2,
    oob3,
    keep2: (1 - oob2) * back(league.keep2, league.oob2),
    keep3: (1 - oob3) * back(league.keep3, league.oob3),
  }
}

// The moments the card asks about, as the shooting team's score and the other team's.
export function situations(target: number): { label: string; a: number; b: number }[] {
  const mid = Math.floor(target / 2)
  return [
    { label: "Tied, start", a: 0, b: 0 },
    { label: `Tied at ${mid}`, a: mid, b: mid },
    { label: "Down 3, late", a: target - 5, b: target - 2 },
    { label: "Down 2, late", a: target - 4, b: target - 2 },
    { label: "Up 2, late", a: target - 2, b: target - 4 },
    { label: `${target - 1} all`, a: target - 1, b: target - 1 },
  ]
}
