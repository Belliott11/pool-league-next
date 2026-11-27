import { games, CREDIT, targetOf } from "@/lib/insight"
import { leagueValues, playValues, type PlayValue } from "@/lib/epa"
import { gameOver } from "@/lib/race"
import { sameMathRules } from "@/lib/rulebook"
import { possessionOdds, tripRates } from "@/lib/shotChoice"
import { usualTarget } from "@/lib/winsAdded"
import type { Game, PooleanState } from "@/lib/types"

// Win chance added, every play: the same question as win chance added (insight.ts, how much each basket moved a team's chance of
// winning), but with a win chance that knows who has the ball (`possessionOdds`, shotChoice.ts: first to the target, win by 2, each
// trip scoring at the league's rates). So plays that score nothing still move it: a miss that goes out of bounds hands the ball over,
// an offensive rebound gets it back, a turnover gives it away, a stop keeps the other team off the board. Like Points added (epa.ts),
// each play is split between the people in it:
//   - a shot: the shooter (65/35 with the passer on an assisted make), against the defenders who guarded it (and a blocker);
//     a miss that stays in bounds is valued at what such a miss is usually worth, and the rebound settles the rest;
//   - the rebound: the offensive rebounder gains what getting it back is worth, a defensive rebounder what taking it away is worth;
//   - a live-ball turnover: who turned it over loses what losing the ball cost, and whoever forced it gains it;
//   - free throws: the points only, to the shooter (who fouled is not logged with them).
// Only games where every shot and turnover has a video time are counted, since the plays have to be in order to know the score.
// On the score alone, from even teams: the pre-game read is left out, as in win chance added, so nobody is credited for who they play.

export interface PlayWpaRow {
  id: string
  games: number
  total: number // in whole games of win chance (0.25 = a quarter of a win)
  shots: number
  passes: number
  boards: number
  defense: number
  turnovers: number
  perGame: number
}

export interface PlayWpa {
  games: number // games counted (every play in order)
  skipped: number // filmed games left out for missing video times
  rows: PlayWpaRow[]
}

type Part = "shots" | "passes" | "boards" | "defense" | "turnovers"

const side = (g: Game, id: string | null | undefined): 0 | 1 | null => (!id ? null : g.teamA.includes(id) ? 0 : g.teamB.includes(id) ? 1 : null)

// Plays of one game in order, with the free throws, or null when any of them has no video time.
function ordered(g: Game, plays: PlayValue[]): ({ ft: false; p: PlayValue } | { ft: true; t: number; player: string })[] | null {
  const mine = plays.filter((p) => p.gameId === g.id)
  if (!mine.length || mine.some((p) => p.t === null)) return null
  const fts = g.scoringEvents.filter((e) => e.points === 1 && e.made !== false)
  if (fts.some((e) => e.videoTime == null)) return null
  return [
    ...mine.map((p) => ({ ft: false as const, p, t: p.t as number })),
    ...fts.map((e) => ({ ft: true as const, t: e.videoTime as number, player: e.scorerId })),
  ].sort((a, b) => a.t - b.t)
}

export function winChancePlays(state: PooleanState): PlayWpa {
  const gs = games(state)
  const plays = playValues(state)
  const newest = gs.map((g) => g.date || "").sort().at(-1)
  const v = leagueValues(sameMathRules(gs, newest))
  const keepOf = (pts: number) => (pts === 2 ? v.keep2 : v.keep3)
  const { t2, t3 } = tripRates(state)
  const usual = usualTarget(state)
  const tables = new Map<number, ReturnType<typeof possessionOdds>>()
  const tableFor = (target: number) => tables.get(target) ?? tables.set(target, possessionOdds(target, t2, t3)).get(target)!

  const by = new Map<string, PlayWpaRow>()
  const row = (id: string) => by.get(id) ?? by.set(id, { id, games: 0, total: 0, shots: 0, passes: 0, boards: 0, defense: 0, turnovers: 0, perGame: 0 }).get(id)!
  const credit = (id: string | null | undefined, part: Part, d: number) => {
    if (!id || !d) return
    const r = row(id)
    r[part] += d
    r.total += d
  }

  let counted = 0
  let skipped = 0
  for (const g of gs) {
    const seq = ordered(g, plays)
    if (!seq) {
      skipped++
      continue
    }
    counted++
    for (const id of [...g.teamA, ...g.teamB]) row(id).games++
    const target = targetOf(g) ?? usual
    const W = tableFor(target)
    const score: [number, number] = [0, 0]
    // The chance a team with a points to the other's b wins, with the ball theirs or not; 1 or 0 once the game is over.
    const wp = (a: number, b: number, ball: boolean) => (gameOver(a, b, target) ? (a > b ? 1 : 0) : W(a, b, ball))
    for (const step of seq) {
      if (step.ft) {
        const s = side(g, step.player)
        if (s === null) continue
        const us = score[s]
        const them = score[1 - s]
        const before = (wp(us, them, true) + wp(us, them, false)) / 2
        score[s] += 1
        const after = (wp(us + 1, them, true) + wp(us + 1, them, false)) / 2
        credit(step.player, "shots", after - before)
        continue
      }
      const p = step.p
      const s = p.side
      const us = score[s]
      const them = score[1 - s]
      const before = wp(us, them, true)
      if (p.kind === "turnover") {
        const d = wp(us, them, false) - before
        credit(p.player, "turnovers", d)
        credit(p.forcer, "defense", -d)
        continue
      }
      // A shot: what it left the team, before any rebound.
      let shot: number
      let rest = 0
      if (p.end === "made") {
        score[s] += p.points
        shot = wp(us + p.points, them, false) - before
      } else if (p.end === "out") {
        shot = wp(us, them, false) - before
      } else {
        const k = keepOf(p.points)
        const back = wp(us, them, true)
        const away = wp(us, them, false)
        const expected = k * back + (1 - k) * away
        shot = expected - before
        rest = (p.end === "kept" ? back : away) - expected
      }
      if (p.passer) {
        credit(p.player, "shots", shot * CREDIT.scorer)
        credit(p.passer, "passes", shot * CREDIT.assister)
      } else credit(p.player, "shots", shot)
      const guards = [...new Set([...p.defenders, ...(p.blocker && side(g, p.blocker) === 1 - s ? [p.blocker] : [])])]
      for (const x of guards) credit(x, "defense", -shot / guards.length)
      // The rebound settles the rest: the offensive rebounder's gain, or the defensive rebounder's (the other side of the loss).
      if (rest && p.rebounder) {
        const rs = side(g, p.rebounder)
        if (rs === s) credit(p.rebounder, "boards", rest)
        else if (rs === 1 - s) credit(p.rebounder, "boards", -rest)
      }
    }
  }
  const rows = [...by.values()]
    .filter((r) => r.games > 0)
    .map((r) => ({ ...r, perGame: r.total / r.games }))
    .sort((a, b) => b.total - a.total)
  return { games: counted, skipped, rows }
}
