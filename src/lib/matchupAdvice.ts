import { countsForBeatRate, beatRates } from "@/lib/beatRate"
import type { PooleanState } from "@/lib/types"

// Who should guard whom for two teams, from the shot log. These are suggestions only: nothing is stored and team balancing is
// untouched. Everything leans on small samples, so each line shows the numbers behind it and fades when either player has fewer
// than MIN_GAMES games.
export const MIN_GAMES = 3
export const HIGH_BEAT = 0.35 // a defender beaten this often is a liability
export const HIGH_RIM = 0.5 // a scorer who takes this share of shots at the rim runs the rim
const RIM_UNITS = 30 // the classic site's default close-range edge, in court units from the hoop
const SHRINK = 5 // shots of league-average play every rate starts with

export interface Defender {
  id: string
  games: number
  faced: number
  beatRate: number // shrunk
  oppFg: number // shrunk, leaving beat shots out
  weak: number // higher is a worse defender: opponent FG% plus beat rate
}
export interface Scorer {
  id: string
  games: number
  shots: number
  pps: number // points per shot, shrunk, leaving beat shots out
  rimShare: number
  beatShare: number // share of their shots that came off a beaten defender
  turnovers: number
  usage: number // shots a game against the busiest scorer's
}
export interface Suggestion {
  defender: Defender
  scorer: Scorer
  reason: string
  thin: boolean // either player has fewer than MIN_GAMES games
}

const shrunk = (n: number, d: number, league: number) => (n + league * SHRINK) / (d + SHRINK)

export function profiles(state: PooleanState) {
  const games = state.games.filter(countsForBeatRate)
  const gp = new Map<string, number>()
  for (const g of games) for (const id of [...g.teamA, ...g.teamB]) gp.set(id, (gp.get(id) ?? 0) + 1)
  const beats = beatRates(state)
  const leagueFaced = beats.reduce((n, r) => n + r.faced, 0)
  const leagueBeat = leagueFaced ? beats.reduce((n, r) => n + r.beat, 0) / leagueFaced : 0
  const oppAtt = beats.reduce((n, r) => n + r.oppAtt, 0)
  const leagueOpp = oppAtt ? beats.reduce((n, r) => n + r.oppMade, 0) / oppAtt : 0
  const defenders = new Map<string, Defender>()
  for (const id of gp.keys()) {
    const r = beats.find((x) => x.id === id)
    const beatRate = shrunk(r?.beat ?? 0, r?.faced ?? 0, leagueBeat)
    const oppFg = shrunk(r?.oppMade ?? 0, r?.oppAtt ?? 0, leagueOpp)
    defenders.set(id, { id, games: gp.get(id) ?? 0, faced: r?.faced ?? 0, beatRate, oppFg, weak: oppFg + beatRate })
  }

  const acc = new Map<string, { shots: number; pts: number; rim: number; located: number; beat: number; tov: number }>()
  for (const g of games) {
    for (const e of g.scoringEvents) {
      if (e.points !== 2 && e.points !== 3) continue
      const a = acc.get(e.scorerId) ?? acc.set(e.scorerId, { shots: 0, pts: 0, rim: 0, located: 0, beat: 0, tov: 0 }).get(e.scorerId)!
      a.shots++
      if (e.contestLevel === "beat") a.beat++
      else a.pts += e.made !== false ? e.points : 0
      if (e.shotLocation) {
        a.located++
        if (e.points === 2 && Math.hypot(e.shotLocation.x - 50, e.shotLocation.y) <= RIM_UNITS) a.rim++
      }
    }
    for (const x of g.turnoverEvents) if (!g.scoringEvents.some((e) => e.turnoverEventId === x.id)) (acc.get(x.playerId) ?? acc.set(x.playerId, { shots: 0, pts: 0, rim: 0, located: 0, beat: 0, tov: 0 }).get(x.playerId)!).tov++
  }
  const nonBeat = [...acc.values()].reduce((n, a) => n + a.shots - a.beat, 0)
  const leaguePps = nonBeat ? [...acc.values()].reduce((n, a) => n + a.pts, 0) / nonBeat : 0
  const perGame = (id: string) => (acc.get(id)?.shots ?? 0) / Math.max(1, gp.get(id) ?? 1)
  const busiest = Math.max(1, ...[...gp.keys()].map(perGame))
  const scorers = new Map<string, Scorer>()
  for (const id of gp.keys()) {
    const a = acc.get(id) ?? { shots: 0, pts: 0, rim: 0, located: 0, beat: 0, tov: 0 }
    scorers.set(id, {
      id,
      games: gp.get(id) ?? 0,
      shots: a.shots,
      pps: shrunk(a.pts, a.shots - a.beat, leaguePps),
      rimShare: a.located ? a.rim / a.located : 0,
      beatShare: a.shots ? a.beat / a.shots : 0,
      turnovers: a.tov,
      usage: perGame(id) / busiest,
    })
  }
  return { defenders, scorers }
}

const cost = (d: Defender, s: Scorer) => s.pps * d.weak + (d.beatRate >= HIGH_BEAT && s.rimShare >= HIGH_RIM ? 1 : 0) + 0.5 * d.beatRate * s.usage

// Every way to give each scorer one defender, with no defender covering more than `cap` of them.
function assignments(scorers: string[], defenders: string[], cap: number): string[][] {
  const out: string[][] = []
  const walk = (i: number, used: Map<string, number>, so: string[]) => {
    if (i === scorers.length) return void out.push([...so])
    for (const d of defenders) {
      if ((used.get(d) ?? 0) >= cap) continue
      used.set(d, (used.get(d) ?? 0) + 1)
      so.push(d)
      walk(i + 1, used, so)
      so.pop()
      used.set(d, (used.get(d) ?? 0) - 1)
    }
  }
  walk(0, new Map(), [])
  return out
}

function reasonFor(d: Defender, s: Scorer, top: boolean, best: boolean): string {
  const pc = (v: number) => `${Math.round(v * 100)}%`
  if (top && best) return `Strongest defender on the most efficient scorer: opponents shoot ${pc(d.oppFg)} against them and they get beat ${pc(d.beatRate)}.`
  if (d.beatRate >= HIGH_BEAT && s.rimShare >= HIGH_RIM) return `Gets beat ${pc(d.beatRate)} of the time, but this scorer lives at the rim (${pc(s.rimShare)} of shots), so this is the best of a bad fit.`
  if (d.beatRate >= HIGH_BEAT) return `Gets beat ${pc(d.beatRate)} of the time, so a lower-usage scorer: ${Math.round(s.usage * 100)}% of the busiest scorer's shots.`
  if (top) return `The most efficient scorer, so the best remaining defender: opponents shoot ${pc(d.oppFg)} against them.`
  return `Best fit by the numbers: opponents shoot ${pc(d.oppFg)} against them, and they get beat ${pc(d.beatRate)}.`
}

// Suggestions for each side: the defenders of one team against the other team's scorers.
export function adviseMatchups(state: PooleanState, teamA: string[], teamB: string[]): { forTeam: "A" | "B"; list: Suggestion[] }[] {
  const { defenders, scorers } = profiles(state)
  const none = (id: string): [Defender, Scorer] => [
    defenders.get(id) ?? { id, games: 0, faced: 0, beatRate: 0, oppFg: 0, weak: 0 },
    scorers.get(id) ?? { id, games: 0, shots: 0, pps: 0, rimShare: 0, beatShare: 0, turnovers: 0, usage: 0 },
  ]
  const side = (mine: string[], theirs: string[], forTeam: "A" | "B") => {
    if (mine.length === 0 || theirs.length === 0) return { forTeam, list: [] as Suggestion[] }
    const cap = Math.ceil(theirs.length / mine.length)
    let best: string[] | null = null
    let bestCost = Infinity
    for (const pick of assignments(theirs, mine, cap)) {
      const c = pick.reduce((n, d, i) => n + cost(none(d)[0], none(theirs[i])[1]), 0)
      if (c < bestCost) {
        bestCost = c
        best = pick
      }
    }
    const topScorer = [...theirs].sort((a, b) => none(b)[1].pps - none(a)[1].pps)[0]
    const strongest = [...mine].sort((a, b) => none(a)[0].weak - none(b)[0].weak)[0]
    const list = theirs
      .map((sid, i) => {
        const d = none(best![i])[0]
        const s = none(sid)[1]
        return { defender: d, scorer: s, reason: reasonFor(d, s, sid === topScorer, d.id === strongest), thin: d.games < MIN_GAMES || s.games < MIN_GAMES }
      })
      .sort((a, b) => b.scorer.pps - a.scorer.pps)
    return { forTeam, list }
  }
  return [side(teamA, teamB, "A"), side(teamB, teamA, "B")]
}
