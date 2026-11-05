import { attendance } from "@/lib/attendance"
import { awardRace } from "@/lib/awardRace"
import { playerLine, scoreOf, type PlayerLine } from "@/lib/nightRecap"
import { seasonState } from "@/lib/offseason"
import { oldPairs } from "@/lib/oldSite"
import { RECORD_LABEL, recordBook } from "@/lib/records"
import type { PooleanState } from "@/lib/types"

// A player's season told one fact at a time, like a year-end recap. Slides with nothing to say are left out.
export type Slide =
  | { kind: "intro"; gp: number; nights: number; totalNights: number; w: number; l: number }
  | { kind: "totals"; pts: number; ptsRank: number; twoWay: number | null; twoWayRank: number | null; players: number }
  | { kind: "best"; gameId: string; date: string; line: PlayerLine }
  | { kind: "teammate"; id: string; w: number; l: number }
  | { kind: "rival"; id: string; w: number; l: number }
  | { kind: "awards"; finishes: { label: string; rank: number }[] }
  | { kind: "records"; rows: { label: string; value: number; date: string }[] }
  | { kind: "summary"; w: number; l: number; pts: number; bestDate: string | null }

interface Totals {
  gp: number
  w: number
  l: number
  pts: number
  twoWay: number
  box: number
}

const rankOf = (value: number, all: number[]) => all.filter((v) => v > value).length + 1

export function wrappedFor(full: PooleanState, id: string): Slide[] {
  const state = seasonState(full)
  const totals = new Map<string, Totals>()
  const mates = new Map<string, { w: number; l: number }>()
  const opps = new Map<string, { w: number; l: number }>()
  let best: { gameId: string; date: string; line: PlayerLine; score: number } | null = null

  for (const g of state.games) {
    const [a, b] = scoreOf(g)
    for (const side of [g.teamA, g.teamB]) {
      const won = side === g.teamA ? a > b : b > a
      const other = side === g.teamA ? g.teamB : g.teamA
      for (const p of side) {
        const line = playerLine(g, p)
        const t = totals.get(p) ?? { gp: 0, w: 0, l: 0, pts: 0, twoWay: 0, box: 0 }
        t.gp++
        if (won) t.w++
        else t.l++
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
        for (const m of side) if (m !== id) bump(mates, m, won)
        for (const o of other) bump(opps, o, won)
      }
    }
  }

  const me = totals.get(id)
  if (!me) return []
  const slides: Slide[] = []
  const att = attendance(state).rows.find((r) => r.id === id)
  slides.push({ kind: "intro", gp: me.gp, nights: att?.nights ?? 0, totalNights: attendance(state).total, w: me.w, l: me.l })

  const all = [...totals.values()]
  const boxed = all.filter((t) => t.box > 0)
  slides.push({
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
  // With no partner played 3 times in the app's own games, fall back to the old site's records, which cover unfilmed games.
  const oldMate = mate ? null : oldPairs(id).mate
  if (mate) slides.push({ kind: "teammate", id: mate[0], ...mate[1] })
  else if (oldMate) slides.push({ kind: "teammate", id: oldMate.id, w: oldMate.w, l: oldMate.l })

  // Rival: the opponent faced most, closest record breaking ties.
  const rival = [...opps.entries()].filter(([, r]) => r.w + r.l >= 2).sort((x, y) => y[1].w + y[1].l - (x[1].w + x[1].l) || Math.abs(x[1].w - x[1].l) - Math.abs(y[1].w - y[1].l))[0]
  const oldRival = rival ? null : oldPairs(id).rival
  if (rival) slides.push({ kind: "rival", id: rival[0], ...rival[1] })
  else if (oldRival) slides.push({ kind: "rival", id: oldRival.id, w: oldRival.w, l: oldRival.l })

  const finishes = awardRace(full)
    .map((r) => ({ label: r.label, rank: r.leaders.findIndex((l) => l.ids.includes(id)) + 1 }))
    .filter((f) => f.rank > 0)
  if (finishes.length) slides.push({ kind: "awards", finishes })

  const rows = Object.values(recordBook(state))
    .filter((r) => r && r.playerId === id)
    .map((r) => ({ label: RECORD_LABEL[r!.key], value: r!.value, date: r!.date }))
  if (rows.length) slides.push({ kind: "records", rows })

  slides.push({ kind: "summary", w: me.w, l: me.l, pts: me.pts, bestDate: best?.date ?? null })
  return slides
}

function bump(map: Map<string, { w: number; l: number }>, id: string, won: boolean) {
  const r = map.get(id) ?? { w: 0, l: 0 }
  if (won) r.w++
  else r.l++
  map.set(id, r)
}

const shrunk = (r: { w: number; l: number }) => (r.w + 2.5) / (r.w + r.l + 5)

// Players who have a Wrapped: anyone who played this season.
export const wrappedPlayers = (full: PooleanState): string[] => {
  const ids = new Set(seasonState(full).games.flatMap((g) => [...g.teamA, ...g.teamB]))
  return full.players.filter((p) => ids.has(p.id)).map((p) => p.id)
}
