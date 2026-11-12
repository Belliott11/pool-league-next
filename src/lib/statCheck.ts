import { games, leagueYardstick } from "@/lib/insight"
import { verdictFromWins, type RuleVerdict } from "@/lib/ruleTests"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

// Do the newer stats line up with winning? For each one, every game asks: did the team that did better on it win? A stat whose better
// side wins no more often than a coin flip, once there are enough games, is a candidate to retire or move out of the way. Games where
// both teams are even on a stat are left out of that stat. Uses every game, since this is about the stat, not this season's players.
export interface StatCheck {
  id: string
  stat: string
  better: string // what "better" means for this stat
  wins: number
  games: number
  verdict: RuleVerdict
  strength: "clear" | "hint" | null
}

type Side = 0 | 1
const sideOf = (g: Game, id: string | null | undefined): Side | null => (!id ? null : g.teamA.includes(id) ? 0 : g.teamB.includes(id) ? 1 : null)
const made = (e: ScoringEvent) => e.made !== false
const fga = (e: ScoringEvent) => e.points === 2 || e.points === 3
const contested = (e: ScoringEvent) => e.contestLevel === "medium" || e.contestLevel === "heavy"

// Each stat as a per-team number for one game, and whether higher is better.
const STATS: { id: string; stat: string; better: string; high: boolean; value: (g: Game, t: Side, expect: (e: ScoringEvent) => number) => number | null }[] = [
  {
    id: "quality",
    stat: "Shot quality",
    better: "took better looks, by the league's points a shot from those spots",
    high: true,
    value: (g, t, expect) => {
      const xs = g.scoringEvents.filter((e) => fga(e) && sideOf(g, e.scorerId) === t)
      return xs.length ? xs.reduce((n, e) => n + expect(e), 0) / xs.length : null
    },
  },
  {
    id: "beat",
    stat: "Beat Rate",
    better: "got beaten less on defense",
    high: false,
    value: (g, t) => {
      const xs = g.scoringEvents.filter((e) => fga(e) && sideOf(g, e.scorerId) === 1 - t && (e.defenderIds ?? []).length > 0)
      return xs.length ? xs.filter((e) => e.contestLevel === "beat").length / xs.length : null
    },
  },
  {
    id: "inposition",
    stat: "Opp FG% in position",
    better: "held the other team to a lower make rate when not beaten",
    high: false,
    value: (g, t) => {
      const xs = g.scoringEvents.filter((e) => fga(e) && sideOf(g, e.scorerId) === 1 - t && (e.defenderIds ?? []).length > 0 && e.contestLevel !== "beat")
      return xs.length ? xs.filter(made).length / xs.length : null
    },
  },
  {
    id: "fought",
    stat: "Fought rebounds",
    better: "won more contested rebounds",
    high: true,
    value: (g, t) => g.scoringEvents.filter((e) => !made(e) && sideOf(g, e.rebounderId) === t && !e.turnoverEventId && (e.reboundContesterIds ?? []).length > 0).length,
  },
  {
    id: "realast",
    stat: "Real assists",
    better: "had more assists, leaving out contested makes the shooter held first",
    high: true,
    value: (g, t) => g.scoringEvents.filter((e) => made(e) && fga(e) && sideOf(g, e.scorerId) === t && e.assistId && !(e.catchAndShoot === false && contested(e))).length,
  },
  {
    id: "livetov",
    stat: "Live-ball turnovers",
    better: "gave the ball away less",
    high: false,
    value: (g, t) => {
      const shotBased = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
      return g.turnoverEvents.filter((x) => !shotBased.has(x.id) && sideOf(g, x.playerId) === t).length
    },
  },
]

export function statCheck(state: PooleanState): StatCheck[] {
  const gs = games(state)
  const expect = leagueYardstick(state)
  return STATS.map((s) => {
    let wins = 0
    let n = 0
    for (const g of gs) {
      const a = s.value(g, 0, expect)
      const b = s.value(g, 1, expect)
      if (a === null || b === null || a === b) continue
      const score = [0, 0]
      for (const e of g.scoringEvents) {
        const t = sideOf(g, e.scorerId)
        if (t !== null && made(e)) score[t] += e.points
      }
      const winner = score[0] > score[1] ? 0 : 1
      const better = (a > b) === s.high ? 0 : 1
      n++
      if (better === winner) wins++
    }
    return { id: s.id, stat: s.stat, better: s.better, wins, games: n, ...verdictFromWins(wins, n) }
  })
}
