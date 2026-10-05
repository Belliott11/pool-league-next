import { injuryBoard, statusInfo } from "@/lib/injuries"
import { labelLine } from "@/lib/labels"
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
// Picks one of several phrasings, the same one every time for the same seed, so headlines vary without shuffling on refresh.
const say = (seed: string, ...options: string[]): string => {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return options[h % options.length]
}

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
    out.push(labelLine(state, s.mvp.id, "mvp", { n: name(s.mvp.id), pts: s.mvp.pts }, s.date) ?? say(s.date + "mvp", `${name(s.mvp.id)} was the MVP of the night with ${s.mvp.pts} points and a two-way score of ${s.mvp.twoWay.toFixed(1)}.`, `MVP of the night: ${name(s.mvp.id)}. ${s.mvp.pts} points, ${s.mvp.twoWay.toFixed(1)} two-way.`, `${name(s.mvp.id)} was the best player of the night, ${s.mvp.pts} points and a ${s.mvp.twoWay.toFixed(1)} two-way score.`))
  }

  for (const p of s.players) {
    if (p.games >= 3 && p.losses === 0) out.push(labelLine(state, p.id, "sweep", { n: name(p.id), w: p.wins }, s.date) ?? say(s.date + p.id + "sweep", `${name(p.id)} did not lose all night, going ${p.wins}-0.`, `${p.wins}-0 for ${name(p.id)}. A perfect night.`, `${name(p.id)} won all ${p.wins} games tonight.`))
    else if (p.games >= 3 && p.wins === 0) out.push(labelLine(state, p.id, "winless", { n: name(p.id), l: p.losses }, s.date) ?? say(s.date + p.id + "winless", `${name(p.id)} went 0-${p.losses} tonight. Tough night.`, `${name(p.id)} lost all ${p.losses} games tonight.`, `0-${p.losses} for ${name(p.id)}. Better luck next time.`))
  }

  for (const c of callouts.filter((x) => x.kind === "record")) {
    out.push(say(s.date + c.playerId + c.key, `New league record: ${name(c.playerId)} had ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} in a game, beating the old record of ${c.previous}${c.holderId ? ` set by ${name(c.holderId)}` : ""}.`, `${name(c.playerId)} set a new ${RECORD_LABEL[c.key].toLowerCase()} record with ${c.value}. The old one was ${c.previous}${c.holderId ? `, held by ${name(c.holderId)}` : ""}.`))
  }
  // A tie only makes a story when the mark is big enough to mean something.
  for (const c of callouts.filter((x) => x.kind === "tied" && x.value >= 3)) {
    out.push(say(s.date + c.playerId + c.key + "tie", `${name(c.playerId)} tied the league ${RECORD_LABEL[c.key].toLowerCase()} record at ${c.value}.`, `${name(c.playerId)} matched the league record of ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}.`))
  }
  for (const c of callouts.filter((x) => x.kind === "careerHigh")) {
    out.push(say(s.date + c.playerId + "ch", `Career high for ${name(c.playerId)}: ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}. The old best was ${c.previous}.`, `${name(c.playerId)} set a new personal best of ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}, up from ${c.previous}.`))
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
      out.push(say(s.date + "upset", `Upset: ${winners.map(name).join(", ")} won ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)} with only a ${pct(u.chance)}% chance going in.`, `${winners.map(name).join(", ")} beat the odds, ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)}. They were given ${pct(u.chance)}% before the game.`))
    }
  }

  if (s.closest && Math.abs(s.closest.scoreA - s.closest.scoreB) <= 2) {
    out.push(say(s.date + "close", `Decided by ${Math.abs(s.closest.scoreA - s.closest.scoreB)}, ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. It could have gone either way.`, `The closest game of the night finished ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}, a ${Math.abs(s.closest.scoreA - s.closest.scoreB)}-point game.`))
  }
  if (s.biggestWin && Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) >= 10) {
    out.push(`${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won by ${Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB)}. It was never close.`)
  }

  const hot = streaks(state, s.date).filter((x) => x.kind === "W" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (hot) out.push(labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, s.date) ?? say(s.date + hot.id + "hot", `${name(hot.id)} has won ${hot.n} games in a row.`, `${name(hot.id)} is on a ${hot.n}-game win streak.`))
  const cold = streaks(state, s.date).filter((x) => x.kind === "L" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (cold) out.push(labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, s.date) ?? say(s.date + cold.id + "cold", `${name(cold.id)} has lost ${cold.n} games in a row.`, `${name(cold.id)} is on a ${cold.n}-game losing streak.`))

  const extra = extraNightStories(state, s, name)
  // The lead story first, then good and bad news taking turns, so the list is never all praise or all roast.
  const head = out.splice(0, s.mvp ? 1 : 0)
  const good = [...out, ...extra.good]
  const bad = extra.bad
  const mixed: string[] = []
  for (let i = 0; i < Math.max(good.length, bad.length); i++) {
    if (good[i]) mixed.push(good[i])
    if (bad[i]) mixed.push(bad[i])
  }
  const all = [...head, ...mixed]
  if (all.length === 0 && s.topScorer) all.push(`${name(s.topScorer.id)} led the night with ${s.topScorer.pts} points.`)
  return all.slice(0, 12)
}

// ---- going into a night ---------------------------------------------------------------------------------
export function previewStories(state: PooleanState, name: Name): string[] {
  const out: string[] = []
  // The injury board comes first: it changes who plays.
  const hurt = injuryBoard(state).filter((i) => i.status !== "returning")
  if (hurt.length) out.push(`On the injury report: ${hurt.map((i) => `${name(i.playerId)} (${statusInfo(i.status).label.toLowerCase()})`).join(", ")}.`)
  const back = injuryBoard(state).filter((i) => i.status === "returning")
  if (back.length) out.push(`Back in the mix: ${back.map((i) => name(i.playerId)).join(", ")}.`)
  const rs = results(state)
  if (rs.length < 4) return out

  // Last time out.
  const lastDate = rs[rs.length - 1].date
  const last = rs.filter((r) => r.date === lastDate)
  const wins = new Map<string, number>()
  last.forEach((r) => r.winners.forEach((id) => wins.set(id, (wins.get(id) ?? 0) + 1)))
  const bestWin = [...wins.entries()].sort((x, y) => y[1] - x[1])[0]
  if (bestWin && bestWin[1] >= 2) out.push(say(lastDate + "last", `Last time out, ${name(bestWin[0])} won ${bestWin[1]} of ${plural(last.length, "game")}.`, `${name(bestWin[0])} took ${bestWin[1]} of ${plural(last.length, "game")} last time out.`))

  const run = streaks(state)
  const hot = run.filter((x) => x.kind === "W" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (hot) out.push(labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, lastDate) ?? say(lastDate + hot.id + "hot", `${name(hot.id)} comes in on a ${hot.n}-game win streak.`, `${name(hot.id)} has won ${hot.n} straight and is the one to beat.`))
  const cold = run.filter((x) => x.kind === "L" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (cold) out.push(labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, lastDate) ?? say(lastDate + cold.id + "cold", `${name(cold.id)} is looking to end a ${cold.n}-game losing streak.`, `${name(cold.id)} has lost ${cold.n} in a row and needs a win.`))

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
  if (leader) out.push(say(lastDate + "lead", `${name(leader[0])} leads the league in two-way score at ${avg(leader[1].tw).toFixed(1)} a game.`, `${avg(leader[1].tw).toFixed(1)} two-way a game makes ${name(leader[0])} the best all-around player so far.`))
  const seasonWins = new Map<string, number>()
  rs.forEach((r) => r.winners.forEach((id) => seasonWins.set(id, (seasonWins.get(id) ?? 0) + 1)))
  const heating = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.recent - x.season >= 2)
    .sort((x, y) => y.recent - y.season - (x.recent - x.season))[0]
  if (heating) out.push(say(lastDate + heating.id + "heat", `${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} points a game over the last 3, up from ${heating.season.toFixed(1)} on the season.`, `${name(heating.id)} has scored ${heating.recent.toFixed(1)} a game lately, compared to ${heating.season.toFixed(1)} on the year.`))

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
    out.push(say(lastDate + top + "rival", `${name(top)} is ${tw}-${bw} against ${name(bottom)}.`, `${name(bottom)} is ${bw}-${tw} against ${name(top)}.`))
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
  // The other side of the ledger.
  const winless = [...per.entries()].map(([id, v]) => ({ id, w: seasonWins.get(id) ?? 0, gp: v.pts.length })).filter((x) => x.w === 0 && x.gp >= 3)[0]
  if (winless) out.push(say(lastDate + winless.id + "wl", `${name(winless.id)} is still looking for a first win.`, `${name(winless.id)} has not won a game yet.`))
  const coldHand = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.season - x.recent >= 2)
    .sort((x, y) => y.season - y.recent - (x.season - x.recent))[0]
  if (coldHand) out.push(say(lastDate + coldHand.id + "ch", `${name(coldHand.id)} has cooled off: ${coldHand.recent.toFixed(1)} points a game over the last 3, down from ${coldHand.season.toFixed(1)}.`, `${name(coldHand.id)} has scored ${coldHand.recent.toFixed(1)} a game lately, down from ${coldHand.season.toFixed(1)} on the year.`))
  const lastTw = [...per.entries()].filter(([, v]) => v.tw.length >= 3).sort((x, y) => avg(x[1].tw) - avg(y[1].tw))[0]
  if (lastTw && avg(lastTw[1].tw) < 0 && lastTw[0] !== leader?.[0]) out.push(say(lastDate + "rear", `${name(lastTw[0])} is last in two-way score at ${avg(lastTw[1].tw).toFixed(1)} a game.`, `${avg(lastTw[1].tw).toFixed(1)} two-way a game puts ${name(lastTw[0])} at the bottom of the league.`))
  return out.slice(0, 8)
}

// ---- the season so far ----------------------------------------------------------------------------------
export function seasonStories(state: PooleanState, name: Name): string[] {
  const since = state.currentSeasonStartedAt || ""
  const rs = results(state).filter((r) => !since || r.date >= since)
  const out: string[] = []
  if (rs.length < 3) return out

  const dates = new Set(rs.map((r) => r.date))
  const totalPts = rs.reduce((n, r) => n + r.a + r.b, 0)
  out.push(`${plural(rs.length, "game")} over ${plural(dates.size, "night")} so far, ${totalPts} points scored.`)

  const rec = new Map<string, { w: number; l: number; pts: number; gp: number; tw: number[] }>()
  for (const r of rs) {
    for (const [ids, won] of [[r.winners, true], [r.losers, false]] as const) {
      for (const id of ids) {
        const cur = rec.get(id) ?? { w: 0, l: 0, pts: 0, gp: 0, tw: [] }
        if (won) cur.w++
        else cur.l++
        cur.gp++
        const line = playerLine(r.game, id)
        cur.pts += line.pts
        if (line.twoWay !== null) cur.tw.push(line.twoWay)
        rec.set(id, cur)
      }
    }
  }
  const all = [...rec.entries()]
  const winPct = (v: { w: number; l: number }) => v.w / (v.w + v.l)
  const ranked = all.filter(([, v]) => v.gp >= 5).sort((x, y) => winPct(y[1]) - winPct(x[1]) || y[1].w - x[1].w)
  if (ranked[0]) out.push(say("pace" + ranked[0][0], `${name(ranked[0][0])} sets the pace at ${ranked[0][1].w}-${ranked[0][1].l} (${pct(winPct(ranked[0][1]))}%).`, `${name(ranked[0][0])} leads the league at ${ranked[0][1].w}-${ranked[0][1].l}.`))
  if (ranked[1] && winPct(ranked[0][1]) - winPct(ranked[1][1]) <= 0.05) out.push(`${name(ranked[0][0])} and ${name(ranked[1][0])} are neck and neck for the top spot.`)

  const scorer = [...all].sort((x, y) => y[1].pts - x[1].pts)[0]
  if (scorer && scorer[1].pts > 0) out.push(say("scorer" + scorer[0], `${name(scorer[0])} is the top scorer with ${scorer[1].pts} points, ${(scorer[1].pts / scorer[1].gp).toFixed(1)} a game.`, `${scorer[1].pts} points for ${name(scorer[0])}, the league's top scorer.`))
  const tw = all.filter(([, v]) => v.tw.length >= 3).sort((x, y) => y[1].tw.reduce((a, b) => a + b, 0) / y[1].tw.length - x[1].tw.reduce((a, b) => a + b, 0) / x[1].tw.length)[0]
  if (tw) out.push(`${name(tw[0])} leads in two-way score at ${(tw[1].tw.reduce((a, b) => a + b, 0) / tw[1].tw.length).toFixed(1)} a game.`)

  // Longest win streak of the season.
  const run = new Map<string, number>()
  let best: { id: string; n: number } | null = null
  for (const r of rs) {
    for (const id of r.winners) {
      const n = (run.get(id) ?? 0) + 1
      run.set(id, n)
      if (!best || n > best.n) best = { id, n }
    }
    for (const id of r.losers) run.set(id, 0)
  }
  const b = best as { id: string; n: number } | null
  if (b && b.n >= 4) out.push(`${name(b.id)}'s ${b.n}-game win streak is the longest of the season.`)

  const iron = [...all].sort((x, y) => y[1].gp - x[1].gp)[0]
  if (iron && iron[1].gp >= 5) out.push(`${name(iron[0])} has played in ${iron[1].gp} of ${rs.length} games, more than anyone.`)

  // Bad news for the season.
  const last = ranked[ranked.length - 1]
  if (last && ranked.length >= 3) out.push(say("last" + last[0], `${name(last[0])} is last in the standings at ${last[1].w}-${last[1].l}.`, `${last[1].w}-${last[1].l} for ${name(last[0])}, the lowest win rate in the league.`))
  const toughest = rs.reduce((m, r) => (Math.abs(r.a - r.b) > Math.abs(m.a - m.b) ? r : m), rs[0])
  if (Math.abs(toughest.a - toughest.b) >= 10) out.push(`The biggest blowout of the season was ${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, with ${toughest.losers.map(name).join(", ")} on the losing end.`)
  const turn = [...rec.keys()]
    .map((id) => {
      const lines = rs.filter((r) => [...r.game.teamA, ...r.game.teamB].includes(id)).map((r) => playerLine(r.game, id)).filter((l) => l.box)
      return { id, n: lines.length, tov: lines.reduce((a, l) => a + l.tov, 0) }
    })
    .filter((x) => x.n >= 3)
    .sort((x, y) => y.tov / y.n - x.tov / x.n)[0]
  if (turn && turn.tov / turn.n >= 1.5) out.push(say("tov" + turn.id, `${name(turn.id)} leads the league in turnovers at ${(turn.tov / turn.n).toFixed(1)} a game.`, `${(turn.tov / turn.n).toFixed(1)} turnovers a game makes ${name(turn.id)} the league leader in giveaways.`))
  return out.slice(0, 8)
}

// ---- more headlines, good and bad -----------------------------------------------------------------------
const fg = (made: number, att: number) => `${made}-for-${att}`

// Extra headlines for a night. Good news and bad news are kept apart so the caller can interleave them.
function extraNightStories(state: PooleanState, s: NightSummary, name: Name): { good: string[]; bad: string[] } {
  const good: string[] = []
  const bad: string[] = []
  const boxed = s.players.filter((p) => p.boxGames > 0)

  // Shooting, hot and cold.
  const shooters = boxed.filter((p) => p.fga >= 6)
  const hot = [...shooters].sort((x, y) => y.fgm / y.fga - x.fgm / x.fga)[0]
  if (hot && hot.fgm / hot.fga >= 0.6) good.push(labelLine(state, hot.id, "hot", { n: name(hot.id), fg: fg(hot.fgm, hot.fga) }, s.date) ?? say(s.date + hot.id + "fg", `${name(hot.id)} shot ${fg(hot.fgm, hot.fga)} from the field.`, `${fg(hot.fgm, hot.fga)} from the field for ${name(hot.id)}, the best shooting night.`))
  const cold = [...shooters].sort((x, y) => x.fgm / x.fga - y.fgm / y.fga)[0]
  if (cold && cold.fgm / cold.fga <= 0.3 && cold.id !== hot?.id) bad.push(labelLine(state, cold.id, "cold", { n: name(cold.id), fg: fg(cold.fgm, cold.fga) }, s.date) ?? say(s.date + cold.id + "fg", `${name(cold.id)} went ${fg(cold.fgm, cold.fga)} from the field. Cold night.`, `${name(cold.id)} shot ${fg(cold.fgm, cold.fga)} and kept shooting.`, `${fg(cold.fgm, cold.fga)} for ${name(cold.id)}. The shots just were not falling.`))

  // Rough nights.
  const worst = [...boxed].sort((x, y) => x.twoWay - y.twoWay)[0]
  if (worst && worst.twoWay < 0 && worst.id !== s.mvp?.id) bad.push(say(s.date + worst.id + "tw", `${name(worst.id)} had a two-way score of ${worst.twoWay.toFixed(1)}, the lowest of the night.`, `${name(worst.id)} was a net negative tonight at ${worst.twoWay.toFixed(1)} two-way.`))
  const sloppy = [...boxed].sort((x, y) => y.tov - x.tov)[0]
  if (sloppy && sloppy.tov >= 4) bad.push(labelLine(state, sloppy.id, "tov", { n: name(sloppy.id), k: sloppy.tov }, s.date) ?? say(s.date + sloppy.id + "tov", `${name(sloppy.id)} had ${sloppy.tov} turnovers, the most of the night.`, `${sloppy.tov} turnovers for ${name(sloppy.id)}.`))
  const fouls = [...boxed].sort((x, y) => y.pf - x.pf)[0]
  if (fouls && fouls.pf >= 4) bad.push(labelLine(state, fouls.id, "foul", { n: name(fouls.id), k: fouls.pf }, s.date) ?? say(s.date + fouls.id + "pf", `${name(fouls.id)} was called for ${fouls.pf} fouls, the most of the night.`, `${fouls.pf} fouls for ${name(fouls.id)}.`))

  // Scoring droughts.
  const scoreless = s.players.filter((p) => p.games >= 2 && p.pts === 0)
  scoreless.forEach((p) => bad.push(labelLine(state, p.id, "zero", { n: name(p.id), g: p.games }, s.date) ?? say(s.date + p.id + "zero", `${name(p.id)} did not score in ${plural(p.games, "game")}.`, `${name(p.id)} played ${plural(p.games, "game")} without scoring.`)))
  const quiet = [...s.players].filter((p) => p.games >= 3 && p.pts > 0).sort((x, y) => x.pts / x.games - y.pts / y.games)[0]
  if (quiet && quiet.pts / quiet.games <= 3) bad.push(`${name(quiet.id)} had a quiet night: ${quiet.pts} points in ${plural(quiet.games, "game")}.`)

  // Defense and hustle.
  const swat = [...boxed].sort((x, y) => y.blk - x.blk)[0]
  if (swat && swat.blk >= 3) good.push(say(s.date + swat.id + "blk", `${name(swat.id)} blocked ${swat.blk} shots.`, `${swat.blk} blocks for ${name(swat.id)}, the most of the night.`))
  const thief = [...boxed].sort((x, y) => y.stl - x.stl)[0]
  if (thief && thief.stl >= 4) good.push(say(s.date + thief.id + "stl", `${name(thief.id)} had ${thief.stl} steals.`, `${thief.stl} steals for ${name(thief.id)}, the most of the night.`))
  const dd = boxed.find((p) => p.pts >= 10 && p.reb >= 10)
  if (dd) good.push(`${name(dd.id)} had a double-double: ${dd.pts} points and ${dd.reb} rebounds.`)
  const dime = boxed.find((p) => p.pts >= 10 && p.ast >= 10)
  if (dime && dime.id !== dd?.id) good.push(`${name(dime.id)} had ${dime.pts} points and ${dime.ast} assists.`)

  // Bounce-backs and slumps, measured from before the night.
  const before = new Map(streaks(state, prevDate(state, s.date)).map((x) => [x.id, x]))
  for (const p of s.players) {
    const b = before.get(p.id)
    if (b && b.kind === "L" && b.n >= 3 && p.wins > 0) good.push(say(s.date + p.id + "snap", `${name(p.id)} finally ended a ${b.n}-game losing streak.`, `${name(p.id)} snapped a ${b.n}-game losing streak with a win tonight.`))
    if (b && b.kind === "W" && b.n >= 3 && p.wins === 0 && p.losses > 0) bad.push(say(s.date + p.id + "over", `${name(p.id)} lost tonight, ending a ${b.n}-game win streak.`, `${name(p.id)}'s ${b.n}-game win streak is over.`))
  }

  // The blown-out side, named.
  const rout = s.biggestWin
  if (rout && Math.abs(rout.scoreA - rout.scoreB) >= 10) {
    const losers = rout.winner === "A" ? rout.teamB : rout.teamA
    bad.push(say(s.date + "rout", `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}, the biggest blowout of the night.`, `${losers.map(name).join(", ")} got blown out, ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}.`))
  }
  const cool = [...streaks(state, s.date)].filter((x) => x.kind === "L" && x.n === 3)
  cool.slice(0, 2).forEach((x) => bad.push(say(s.date + x.id + "three", `${name(x.id)} has now lost 3 in a row.`, `3 straight losses for ${name(x.id)}.`)))

  // Attendance: regulars who did not show.
  const nights = [...new Set(state.games.filter((g) => !g.liveInProgress && g.date && g.date < s.date).map((g) => g.date))]
  if (nights.length >= 4) {
    const played = new Map<string, Set<string>>()
    for (const g of state.games) {
      if (g.liveInProgress || !g.date || g.date >= s.date) continue
      for (const id of [...g.teamA, ...g.teamB]) played.set(id, (played.get(id) ?? new Set()).add(g.date))
    }
    const tonight = new Set(s.players.map((p) => p.id))
    const regulars = [...played.entries()].filter(([id, d]) => d.size / nights.length >= 0.6 && !tonight.has(id)).sort((x, y) => y[1].size - x[1].size)
    regulars.slice(0, 2).forEach(([id]) => bad.push(labelLine(state, id, "noshow", { n: name(id) }, s.date) ?? say(s.date + id + "ns", `${name(id)} was not there tonight and usually is.`, `${name(id)} missed the night.`)))
  }

  // How the whole night felt.
  const perGame = (date: string) => {
    const gs = state.games.filter((g) => g.date === date && !g.liveInProgress)
    const pts = gs.reduce((n, g) => { const [a, b] = scoreOf(g); return n + a + b }, 0)
    return gs.length ? pts / gs.length : 0
  }
  const others = nights.map(perGame).filter((x) => x > 0)
  const tonightAvg = perGame(s.date)
  if (others.length >= 3 && tonightAvg > 0) {
    if (tonightAvg > Math.max(...others)) good.push(`The highest-scoring night yet at ${tonightAvg.toFixed(1)} points a game.`)
    else if (tonightAvg < Math.min(...others)) bad.push(say(s.date + "low", `The lowest-scoring night on record, ${tonightAvg.toFixed(1)} points a game.`, `${tonightAvg.toFixed(1)} points a game, the fewest of any night so far.`))
  }
  return { good, bad }
}

// The night before a date, for streaks as they stood going in.
function prevDate(state: PooleanState, date: string): string {
  const days = [...new Set(state.games.filter((g) => g.date && g.date < date).map((g) => g.date))].sort()
  return days[days.length - 1] ?? ""
}
