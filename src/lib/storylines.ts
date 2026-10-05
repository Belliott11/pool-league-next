import type { NightSummary } from "@/lib/nightRecap"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import { RECORD_LABEL, recordBook, type Callout } from "@/lib/records"
import type { Game, PooleanState } from "@/lib/types"

// Storylines written from the stats with fixed sentence patterns: free, instant and always the same facts.
// "Coming out" stories read a finished night; "going in" stories look ahead from the whole history.
type Name = (id: string) => string

interface Result {
  game: Game
  date: string
  winners: string[]
  losers: string[]
  a: number
  b: number
}

// Finished games with a winner, oldest first (date, then the order they were logged).
function results(state: PooleanState): Result[] {
  return state.games
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => !g.liveInProgress && g.date)
    .sort((x, y) => x.g.date.localeCompare(y.g.date) || x.i - y.i)
    .flatMap(({ g }) => {
      const [a, b] = scoreOf(g)
      if (a === b) return []
      return [{ game: g, date: g.date, winners: a > b ? g.teamA : g.teamB, losers: a > b ? g.teamB : g.teamA, a, b }]
    })
}

// Current win or loss run for each player.
export function streaks(state: PooleanState, upTo?: string): { id: string; kind: "W" | "L"; n: number }[] {
  const run = new Map<string, { kind: "W" | "L"; n: number }>()
  for (const r of results(state)) {
    if (upTo && r.date > upTo) continue
    for (const [ids, kind] of [[r.winners, "W"], [r.losers, "L"]] as const) {
      for (const id of ids) {
        const cur = run.get(id)
        run.set(id, cur && cur.kind === kind ? { kind, n: cur.n + 1 } : { kind, n: 1 })
      }
    }
  }
  return [...run.entries()].map(([id, v]) => ({ id, ...v }))
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const pct = (p: number) => Math.round(p * 100)

// ---- coming out of a night ------------------------------------------------------------------------------
export function nightStories(
  state: PooleanState,
  s: NightSummary,
  callouts: Callout[],
  name: Name,
  predict?: (a: string[], b: string[]) => { pA: number } | null,
): string[] {
  const out: string[] = []
  const done = s.games.filter((g) => !g.live && g.winner)

  if (s.mvp && s.mvp.boxGames > 0) {
    out.push(`${name(s.mvp.id)} was the night's MVP with a total two-way score of ${s.mvp.twoWay.toFixed(1)} across ${plural(s.mvp.boxGames, "game")}, scoring ${s.mvp.pts}.`)
  }

  for (const p of s.players) {
    if (p.games >= 3 && p.losses === 0) out.push(`${name(p.id)} swept the night, ${p.wins}-0.`)
    else if (p.games >= 3 && p.wins === 0) out.push(`${name(p.id)} could not buy a win, going 0-${p.losses}.`)
  }

  for (const c of callouts.filter((x) => x.kind === "record")) {
    out.push(`New league record: ${name(c.playerId)}'s ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} in a game, up from ${c.previous}${c.holderId ? ` (${name(c.holderId)})` : ""}.`)
  }
  // A tie only makes a story when the mark is big enough to mean something.
  for (const c of callouts.filter((x) => x.kind === "tied" && x.value >= 3)) {
    out.push(`${name(c.playerId)} tied the league record for ${RECORD_LABEL[c.key].toLowerCase()} in a game, ${c.value}.`)
  }
  for (const c of callouts.filter((x) => x.kind === "careerHigh")) {
    out.push(`Career high for ${name(c.playerId)}: ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}, beating ${c.previous}.`)
  }

  if (predict) {
    // The biggest upset by the pre-game odds, if anyone beat a clear favorite.
    let upset: { chance: number; i: number } | null = null
    done.forEach((g, i) => {
      const p = predict(g.teamA, g.teamB)
      if (!p) return
      const chance = g.winner === "A" ? p.pA : 1 - p.pA
      if (chance <= 0.35 && (!upset || chance < upset.chance)) upset = { chance, i }
    })
    const u = upset as { chance: number; i: number } | null
    if (u) {
      const g = done[u.i]
      const winners = g.winner === "A" ? g.teamA : g.teamB
      out.push(`Upset of the night: ${winners.map(name).join(", ")} won ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)} when the model gave them ${pct(u.chance)}%.`)
    }
  }

  if (s.closest && Math.abs(s.closest.scoreA - s.closest.scoreB) <= 2) {
    out.push(`The closest game came down to ${Math.abs(s.closest.scoreA - s.closest.scoreB)}, ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}.`)
  }
  if (s.biggestWin && Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) >= 10) {
    out.push(`The night's rout was ${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}.`)
  }

  const hot = streaks(state, s.date).filter((x) => x.kind === "W" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (hot) out.push(`${name(hot.id)} has now won ${hot.n} straight.`)
  const cold = streaks(state, s.date).filter((x) => x.kind === "L" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (cold) out.push(`${name(cold.id)} has lost ${cold.n} in a row.`)

  if (out.length === 0 && s.topScorer) out.push(`${name(s.topScorer.id)} led the night with ${s.topScorer.pts} points.`)
  return out.slice(0, 8)
}

// ---- going into a night ---------------------------------------------------------------------------------
export function previewStories(state: PooleanState, name: Name): string[] {
  const out: string[] = []
  const rs = results(state)
  if (rs.length < 4) return out

  // Last time out.
  const lastDate = rs[rs.length - 1].date
  const last = rs.filter((r) => r.date === lastDate)
  const wins = new Map<string, number>()
  last.forEach((r) => r.winners.forEach((id) => wins.set(id, (wins.get(id) ?? 0) + 1)))
  const bestWin = [...wins.entries()].sort((x, y) => y[1] - x[1])[0]
  if (bestWin && bestWin[1] >= 2) out.push(`Last time out, ${name(bestWin[0])} won ${bestWin[1]} of ${plural(last.length, "game")}.`)

  const run = streaks(state)
  const hot = run.filter((x) => x.kind === "W" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (hot) out.push(`${name(hot.id)} walks in on a ${hot.n}-game win streak.`)
  const cold = run.filter((x) => x.kind === "L" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (cold) out.push(`${name(cold.id)} is looking to snap a ${cold.n}-game losing streak.`)

  // Season-long two-way leader and hot hands, from games with a box score.
  const per = new Map<string, { tw: number[]; pts: number[] }>()
  for (const r of rs) {
    for (const id of [...r.game.teamA, ...r.game.teamB]) {
      const line = playerLine(r.game, id)
      const cur = per.get(id) ?? { tw: [], pts: [] }
      cur.pts.push(line.pts)
      if (line.twoWay !== null) cur.tw.push(line.twoWay)
      per.set(id, cur)
    }
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
  const leader = [...per.entries()].filter(([, v]) => v.tw.length >= 3).sort((x, y) => avg(y[1].tw) - avg(x[1].tw))[0]
  if (leader) out.push(`${name(leader[0])} leads the league in two-way score, ${avg(leader[1].tw).toFixed(1)} per game.`)
  const heating = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.recent - x.season >= 2)
    .sort((x, y) => y.recent - y.season - (x.recent - x.season))[0]
  if (heating) out.push(`${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} points over the last 3 games, up from ${heating.season.toFixed(1)} on the year.`)

  // Chasing a record.
  const book = recordBook(state)
  const pts = book.pts
  if (pts) {
    const near = [...per.entries()]
      .map(([id, v]) => ({ id, best: Math.max(0, ...v.pts) }))
      .filter((x) => x.best < pts.value && pts.value - x.best <= 2 && x.id !== pts.playerId)
      .sort((x, y) => y.best - x.best)[0]
    if (near) out.push(`${name(near.id)}'s best game, ${near.best}, is ${pts.value - near.best} shy of ${name(pts.playerId)}'s league record of ${pts.value} points.`)
  }

  // The most lopsided rivalry among players who have met often.
  const h2h = new Map<string, { a: string; b: string; aw: number; bw: number }>()
  for (const r of rs) {
    for (const w of r.winners) {
      for (const l of r.losers) {
        const [a, b] = w < l ? [w, l] : [l, w]
        const k = `${a}|${b}`
        const row = h2h.get(k) ?? { a, b, aw: 0, bw: 0 }
        if (w === a) row.aw++
        else row.bw++
        h2h.set(k, row)
      }
    }
  }
  const rival = [...h2h.values()].filter((x) => x.aw + x.bw >= 5).sort((x, y) => Math.abs(y.aw - y.bw) - Math.abs(x.aw - x.bw))[0]
  if (rival && Math.abs(rival.aw - rival.bw) >= 3) {
    const [top, bottom, tw, bw] = rival.aw > rival.bw ? [rival.a, rival.b, rival.aw, rival.bw] : [rival.b, rival.a, rival.bw, rival.aw]
    out.push(`${name(top)} owns the series with ${name(bottom)}, ${tw}-${bw}.`)
  }

  // A milestone within reach.
  for (const [id, v] of per.entries()) {
    const gp = v.pts.length
    const next = [25, 50, 75, 100, 150, 200].find((m) => m > gp)
    if (next && next - gp <= 1 && gp >= 10) {
      out.push(`${name(id)} is ${next - gp === 1 ? "one game" : `${next - gp} games`} from ${next} played.`)
      break
    }
  }
  for (const [id, v] of per.entries()) {
    const total = v.pts.reduce((a, b) => a + b, 0)
    const next = Math.ceil((total + 1) / 100) * 100
    if (next - total <= 15 && total >= 100) {
      out.push(`${name(id)} is ${next - total} points from ${next} career points.`)
      break
    }
  }
  return out.slice(0, 6)
}
