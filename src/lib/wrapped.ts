import { awardRace } from "@/lib/awardRace"
import { playerLine, type PlayerLine } from "@/lib/nightRecap"
import { seasonState } from "@/lib/offseason"
import { allResults } from "@/lib/hallOfFame"
import { currentRealSeason, type RealGame } from "@/lib/real"
import { ordinalOf } from "@/lib/ordinal"
import { RECORD_LABEL, holders, recordBook } from "@/lib/records"
import type { PooleanState } from "@/lib/types"

// A player's season told one fact at a time, like a year-end recap. Slides with nothing to say are left out.
export type Slide =
  | { kind: "intro"; gp: number; nights: number; totalNights: number; w: number; l: number }
  | { kind: "totals"; pts: number; ptsRank: number; twoWay: number | null; twoWayRank: number | null; players: number }
  | { kind: "best"; gameId: string; date: string; line: PlayerLine }
  | { kind: "teammate"; id: string; w: number; l: number }
  | { kind: "rival"; id: string; w: number; l: number }
  | { kind: "awards"; finishes: { label: string; place: string }[] }
  | { kind: "records"; rows: { label: string; value: number; date: string; tiedWith: string[] }[] }
  | { kind: "summary"; w: number; l: number; pts: number | null; bestDate: string | null }

interface Totals {
  pts: number
  twoWay: number
  box: number
}

const rankOf = (value: number, all: number[]) => all.filter((v) => v > value).length + 1

// The old site's results for the season just played. Games, wins, nights, teammates and rivals count these, so unfilmed
// games are in; points, two-way and the best game can only come from games played in the app.
const seasonOld = (full: PooleanState): RealGame[] => (currentRealSeason()?.games ?? []).filter((g) => !full.currentSeasonStartedAt || g.date >= full.currentSeasonStartedAt)

export function wrappedFor(full: PooleanState, id: string, old: RealGame[] = seasonOld(full)): Slide[] {
  const state = seasonState(full)
  const results = allResults(state, old)
  const totals = new Map<string, Totals>()
  const mates = new Map<string, { w: number; l: number }>()
  const opps = new Map<string, { w: number; l: number }>()
  let best: { gameId: string; date: string; line: PlayerLine; score: number } | null = null

  for (const g of state.games) {
    for (const side of [g.teamA, g.teamB]) {
      for (const p of side) {
        const line = playerLine(g, p)
        const t = totals.get(p) ?? { pts: 0, twoWay: 0, box: 0 }
        t.pts += line.pts
        if (line.twoWay !== null) {
          t.twoWay += line.twoWay
          t.box++
        }
        totals.set(p, t)
        if (p !== id) continue
        // Best game: highest two-way when there is a box score, otherwise the most points.
        const score = line.twoWay ?? line.pts / 100
        if (!best || score > best.score) best = { gameId: g.id, date: g.date, line, score }
      }
    }
  }

  let w = 0
  let l = 0
  const nights = new Set<string>()
  for (const g of results) {
    const won = g.won.includes(id)
    if (!won && !g.lost.includes(id)) continue
    won ? w++ : l++
    nights.add(g.date)
    for (const m of won ? g.won : g.lost) if (m !== id) bump(mates, m, won)
    for (const o of won ? g.lost : g.won) bump(opps, o, won)
  }
  if (w + l === 0) return []
  const me = totals.get(id)
  const slides: Slide[] = []
  slides.push({ kind: "intro", gp: w + l, nights: nights.size, totalNights: new Set(results.map((g) => g.date)).size, w, l })

  const all = [...totals.values()]
  const boxed = all.filter((t) => t.box > 0)
  if (me) slides.push({
    kind: "totals",
    pts: me.pts,
    ptsRank: rankOf(me.pts, all.map((t) => t.pts)),
    twoWay: me.box > 0 ? Math.round(me.twoWay * 10) / 10 : null,
    twoWayRank: me.box > 0 ? rankOf(me.twoWay, boxed.map((t) => t.twoWay)) : null,
    players: all.length,
  })

  if (best) slides.push({ kind: "best", gameId: best.gameId, date: best.date, line: best.line })

  // Best teammate: best record together over at least 3 games, pulled toward even by 5 phantom games (as the duo award).
  const mate = [...mates.entries()].filter(([, r]) => r.w + r.l >= 3).sort((x, y) => shrunk(y[1]) - shrunk(x[1]) || y[1].w + y[1].l - (x[1].w + x[1].l))[0]
  if (mate) slides.push({ kind: "teammate", id: mate[0], ...mate[1] })

  // Rival: the opponent faced most, closest record breaking ties.
  const rival = [...opps.entries()].filter(([, r]) => r.w + r.l >= 2).sort((x, y) => y[1].w + y[1].l - (x[1].w + x[1].l) || Math.abs(x[1].w - x[1].l) - Math.abs(y[1].w - y[1].l))[0]
  if (rival) slides.push({ kind: "rival", id: rival[0], ...rival[1] })

  // The season's voted awards when the old site has a ballot for it, otherwise the race from the app's own games.
  const ballot = old.length > 0 ? ((currentRealSeason() as unknown as { awards?: Award[] } | null)?.awards ?? []) : []
  const finishes = ballot.length > 0 ? ballotFinishes(ballot, id) : raceFinishes(full, id)
  if (finishes.length) slides.push({ kind: "awards", finishes })

  const rows = Object.values(recordBook(state))
    .filter((r) => r && holders(r).includes(id))
    .map((r) => ({ label: RECORD_LABEL[r!.key], value: r!.value, date: r!.date, tiedWith: holders(r!).filter((x) => x !== id) }))
  if (rows.length) slides.push({ kind: "records", rows })

  slides.push({ kind: "summary", w, l, pts: me?.pts ?? null, bestDate: best?.date ?? null })
  return slides
}

export interface Award {
  key: string
  winners: string[]
  votedStandings: { slug: string; points: number }[]
}
const AWARD_LABEL: Record<string, string> = {
  mvp: "MVP", "best-player": "Best Player", dpoy: "Defensive Player", clutch: "Clutch", "mip-season": "Most Improved (Season)", "mip-yoy": "Most Improved (Year over Year)",
  teammate: "Best Teammate", "first-team": "First Team", "second-team": "Second Team", "best-duo": "Best Duo",
}
const TEAMS = new Set(["first-team", "second-team"])
const TOP = 3

// Where a player finished on each voted award, best first, for the top three. The winner comes first even when the vote was
// level, and the label says when it was. Teams have no order, so they are simply made or not.
export function ballotFinishes(awards: Award[], id: string): { label: string; place: string }[] {
  const out: { label: string; place: string; rank: number }[] = []
  for (const a of awards) {
    const label = AWARD_LABEL[a.key]
    if (!label) continue // the Worst Duo is not a finish to celebrate
    if (TEAMS.has(a.key)) {
      if (a.winners.includes(id)) out.push({ label, place: "Made it", rank: 1 })
      continue
    }
    const won = (slug: string) => slug.split("|").every((s) => a.winners.includes(s))
    const mine = a.votedStandings.find((v) => v.slug.split("|").includes(id))
    if (!mine) continue
    const winners = a.votedStandings.filter((v) => won(v.slug))
    const rest = a.votedStandings.filter((v) => !won(v.slug))
    const iWon = won(mine.slug)
    const rank = iWon ? 1 : winners.length + rest.filter((v) => v.points > mine.points).length + 1
    if (rank > TOP) continue
    const level = a.votedStandings.filter((v) => v.points === mine.points).length > 1
    const shared = iWon ? winners.length > 1 : rest.filter((v) => v.points === mine.points).length > 1
    out.push({ label: level ? `${label} (tied on votes)` : label, place: `${shared ? "T" : ""}${ordinalOf(rank)}`, rank })
  }
  return out.sort((x, y) => x.rank - y.rank).map(({ label, place }) => ({ label, place }))
}

function raceFinishes(full: PooleanState, id: string): { label: string; place: string }[] {
  return awardRace(full)
    .filter((r) => r.key !== "worst-duo")
    .flatMap((r) => {
      const me = r.leaders.find((l) => l.ids.includes(id))
      if (!me) return []
      const level = r.leaders.filter((l) => l.value === me.value)
      return [{ label: r.label, place: `${level.length > 1 ? "T" : ""}${ordinalOf(r.leaders.indexOf(level[0]) + 1)}` }]
    })
}

function bump(map: Map<string, { w: number; l: number }>, id: string, won: boolean) {
  const r = map.get(id) ?? { w: 0, l: 0 }
  if (won) r.w++
  else r.l++
  map.set(id, r)
}

const shrunk = (r: { w: number; l: number }) => (r.w + 2.5) / (r.w + r.l + 5)

// Players who have a Wrapped: anyone who played this season.
export const wrappedPlayers = (full: PooleanState, old: RealGame[] = seasonOld(full)): string[] => {
  const ids = new Set(allResults(seasonState(full), old).flatMap((g) => [...g.won, ...g.lost]))
  return full.players.filter((p) => ids.has(p.id)).map((p) => p.id)
}
