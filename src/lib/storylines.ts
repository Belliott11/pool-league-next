import { injuryBoard, statusInfo } from "@/lib/injuries"
import { pick } from "@/lib/pick"
import { isHidden, labelLine } from "@/lib/labels"
import type { NightSummary } from "@/lib/nightRecap"
import { playerLine, scoreOf, type PlayerLine } from "@/lib/nightRecap"
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
const say = (seed: string, ...options: string[]): string => {
  // A wording the editor thumbed down is skipped when another one is available.
  const live = options.filter((o) => !isHidden(o))
  const pool = live.length ? live : options
  return pick(seed, pool)
}

// Candidate headlines come with a weight for how unusual they are; the most unusual go first, no player gets more
// than two (three on the season card), and anything the editor removed is dropped.
type Item = { w: number; pid: string | null; text: string }
function rank(items: Item[], limit: number, perPlayerMax = 2): string[] {
  const perPlayer = new Map<string, number>()
  return items
    .sort((x, y) => y.w - x.w)
    .filter((it) => {
      if (!it.pid) return true
      const n = (perPlayer.get(it.pid) ?? 0) + 1
      perPlayer.set(it.pid, n)
      return n <= perPlayerMax
    })
    .map((it) => it.text)
    .filter((x) => !isHidden(x))
    .slice(0, limit)
}
// How far a value sits from the others, in standard deviations.
function zAmong(xs: number[], v: number): number {
  if (xs.length < 3) return 1
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
  return Math.min(6, Math.abs(v - m) / Math.max(sd, 0.1 * Math.max(Math.abs(m), 1)))
}

// ---- coming out of a night ------------------------------------------------------------------------------
export function nightStories(
  state: PooleanState,
  s: NightSummary,
  callouts: Callout[],
  name: Name,
  predict?: (a: string[], b: string[]) => { pA: number } | null,
): string[] {
  // Every candidate headline carries a weight for how unusual it is, so the recap leads with the most abnormal things
  // of the night rather than a fixed order. For stat lines the weight is how many standard deviations tonight sat
  // from that player's own history (or the league's, for someone with too few games).
  const items: Item[] = []
  const add = (w: number, pid: string | null, text: string) => items.push({ w, pid, text })
  const abn = abnormality(state, s.date)
  const done = s.games.filter((g) => !g.live && g.winner)

  if (s.mvp && s.mvp.boxGames > 0) {
    add(99, s.mvp.id, labelLine(state, s.mvp.id, "mvp", { n: name(s.mvp.id), pts: s.mvp.pts }, s.date) ?? say(s.date + "mvp", `${name(s.mvp.id)} ran away with MVP, ${s.mvp.pts} points and a ${s.mvp.twoWay.toFixed(1)} two-way score, and nobody else got close.`, `Was there any doubt? ${name(s.mvp.id)} took MVP with ${s.mvp.pts} points.`, `Night MVP goes to ${name(s.mvp.id)}: ${s.mvp.pts} points, ${s.mvp.twoWay.toFixed(1)} two-way, and no real argument.`, `"I will take it," ${name(s.mvp.id)} will say about MVP, to all ${s.players.length - 1} other players, all week.`))
  }

  for (const p of s.players) {
    if (p.games >= 3 && p.losses === 0) add(1.5 + p.games * 0.4, p.id, labelLine(state, p.id, "sweep", { n: name(p.id), w: p.wins }, s.date) ?? say(s.date + p.id + "sweep", `Nobody beat ${name(p.id)} all night. ${p.wins} games, ${p.wins} wins.`, `${name(p.id)} walked out ${p.wins}-0 and is already telling people about it.`, `Try finding a game ${name(p.id)} lost tonight. You cannot, they went ${p.wins}-0.`))
    else if (p.games >= 3 && p.wins === 0) add(1.5 + p.games * 0.4, p.id, labelLine(state, p.id, "winless", { n: name(p.id), l: p.losses }, s.date) ?? say(s.date + p.id + "winless", `${name(p.id)} lost all ${p.losses} games tonight, which is hard to do on purpose.`, `How do you go 0-${p.losses}? Ask ${name(p.id)}.`, `Whoever had ${name(p.id)} on their team tonight lost, ${p.losses} times out of ${p.losses}.`))
  }

  for (const c of callouts.filter((x) => x.kind === "record")) {
    add(4.5, c.playerId, say(s.date + c.playerId + c.key, `${name(c.playerId)} now owns the ${RECORD_LABEL[c.key].toLowerCase()} record with ${c.value}${c.holderId ? ", taking it from " + name(c.holderId) : ""}, and the old mark of ${c.previous} is history.`, `Break out the asterisk: ${name(c.playerId)} put up ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}, a new league record.`, `${c.holderId ? name(c.holderId) + " held the " + RECORD_LABEL[c.key].toLowerCase() + " record at " + c.previous + " until tonight. " : ""}${name(c.playerId)} made it ${c.value}.`))
  }
  // A tie only makes a story when the mark is big enough to mean something.
  for (const c of callouts.filter((x) => x.kind === "tied" && x.value >= 3)) {
    add(2.5, c.playerId, say(s.date + c.playerId + c.key + "tie", `${name(c.playerId)} tied the league ${RECORD_LABEL[c.key].toLowerCase()} record at ${c.value}. Close enough to brag.`, `Same number, different name: ${name(c.playerId)} matched the league ${RECORD_LABEL[c.key].toLowerCase()} record of ${c.value}.`, `One more and ${name(c.playerId)} would have taken the ${RECORD_LABEL[c.key].toLowerCase()} record outright. A tie at ${c.value} will have to do.`))
  }
  for (const c of callouts.filter((x) => x.kind === "careerHigh")) {
    add(2.5, c.playerId, say(s.date + c.playerId + "ch", `${name(c.playerId)} just had the best ${RECORD_LABEL[c.key].toLowerCase()} game of their career, ${c.value}, beating the old high of ${c.previous}.`, `New personal best for ${name(c.playerId)}: ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}. The last one was ${c.previous}.`, `${c.previous} was ${name(c.playerId)}'s career high in ${RECORD_LABEL[c.key].toLowerCase()} until tonight. It is ${c.value} now.`))
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
      add(2 + (0.35 - u.chance) * 10, null, say(s.date + "upset", `Nobody gave ${winners.map(name).join(", ")} much of a chance, ${pct(u.chance)}%, and they won ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)} anyway.`, `The odds said ${pct(u.chance)}% and ${winners.map(name).join(", ")} did not care. ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)}.`, `${winners.map(name).join(", ")} beat a team that was supposed to win, ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)}, from ${pct(u.chance)}% odds. The favorites have some thinking to do.`))
    }
  }

  if (s.closest && Math.abs(s.closest.scoreA - s.closest.scoreB) <= 2) {
    add(1.5, null, say(s.date + "close", `${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. One bounce the other way and the whole story changes.`, `The closest game of the night came down to ${Math.abs(s.closest.scoreA - s.closest.scoreB)}, ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}.`, `Was that a foul? Was that out? Either way it ended ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}.`, `A coin flip would have been less stressful than that ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)} finish.`))
  }
  if (s.biggestWin && Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) >= 10) {
    add(Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) / 5, null, say(s.date + "win", `${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won by ${Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB)}, ${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}, and the other side knew by halftime.`, `${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}: not a game, a lesson from ${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")}.`))
  }

  const hot = streaks(state, s.date).filter((x) => x.kind === "W" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (hot) add(hot.n * 0.6, hot.id, labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, s.date) ?? say(s.date + hot.id + "hot", `${name(hot.id)} has won ${hot.n} straight and nobody has found an answer yet.`, `${hot.n} wins in a row for ${name(hot.id)}. Who is going to stop them?`, `Somebody beat ${name(hot.id)} already, please. They have won ${hot.n} straight.`))
  const cold = streaks(state, s.date).filter((x) => x.kind === "L" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (cold) add(cold.n * 0.6, cold.id, labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, s.date) ?? say(s.date + cold.id + "cold", `${name(cold.id)} has lost ${cold.n} in a row, and at some point it stops being bad luck.`, `${cold.n} straight losses for ${name(cold.id)}. Teams are starting to pick them last.`, `Is it ${name(cold.id)}, or is it the teams? ${cold.n} losses in a row says it might be ${name(cold.id)}.`))

  extraNightStories(state, s, name, add, abn)
  // Most unusual first, and no player gets more than two headlines so one big night does not take over the list.
  const all = rank(items, 12)
  if (all.length === 0 && s.topScorer) all.push(`${name(s.topScorer.id)} led the night with ${s.topScorer.pts} points.`)
  return all
}

// ---- going into a night ---------------------------------------------------------------------------------
export function previewStories(state: PooleanState, name: Name): string[] {
  const items: Item[] = []
  const add = (w: number, pid: string | null, text: string) => items.push({ w, pid, text })
  const abn = abnormality(state, "9999-12-31")
  // The injury board comes first: it changes who plays.
  const hurt = injuryBoard(state).filter((i) => i.status !== "returning")
  if (hurt.length) add(99, null, `On the injury report: ${hurt.map((i) => `${name(i.playerId)} (${statusInfo(i.status).label.toLowerCase()})`).join(", ")}.`)
  const back = injuryBoard(state).filter((i) => i.status === "returning")
  if (back.length) add(98, null, `Back in the mix: ${back.map((i) => name(i.playerId)).join(", ")}.`)
  const rs = results(state)
  if (rs.length < 4) return rank(items, 8)

  // Last time out.
  const lastDate = rs[rs.length - 1].date
  const last = rs.filter((r) => r.date === lastDate)
  const wins = new Map<string, number>()
  last.forEach((r) => r.winners.forEach((id) => wins.set(id, (wins.get(id) ?? 0) + 1)))
  const bestWin = [...wins.entries()].sort((x, y) => y[1] - x[1])[0]
  if (bestWin && bestWin[1] >= 2) add(1.5 + bestWin[1] * 0.5, bestWin[0], say(lastDate + "last", `Last time out, ${name(bestWin[0])} won ${bestWin[1]} of ${plural(last.length, "game")} and nobody forgot it.`, `${name(bestWin[0])} took ${bestWin[1]} of ${plural(last.length, "game")} last time. The rematch starts tonight.`, `Who beats ${name(bestWin[0])} tonight? They won ${bestWin[1]} of ${plural(last.length, "game")} last time.`))

  const run = streaks(state)
  const hot = run.filter((x) => x.kind === "W" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (hot) add(hot.n * 0.6, hot.id, labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, lastDate) ?? say(lastDate + hot.id + "hot", `${name(hot.id)} walks in on a ${hot.n}-game win streak.`, `Can anybody stop ${name(hot.id)}? They have won ${hot.n} straight.`, `${hot.n} straight wins for ${name(hot.id)}, so everyone gets a turn trying to end it.`))
  const cold = run.filter((x) => x.kind === "L" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (cold) add(cold.n * 0.6, cold.id, labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, lastDate) ?? say(lastDate + cold.id + "cold", `${name(cold.id)} is trying to end a ${cold.n}-game losing streak tonight.`, `${cold.n} losses in a row for ${name(cold.id)}. Tonight is a good time for a win.`, `Something has to give for ${name(cold.id)}: ${cold.n} straight losses.`))

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
  if (leader) add(2 + zAmong([...per.values()].filter((v) => v.tw.length >= 3).map((v) => avg(v.tw)), avg(leader[1].tw)), leader[0], say(lastDate + "lead", `${name(leader[0])} leads the league in two-way score at ${avg(leader[1].tw).toFixed(1)} a game.`, `Nobody does more on both ends than ${name(leader[0])}, ${avg(leader[1].tw).toFixed(1)} two-way a game.`, `Who is better all-around than ${name(leader[0])}? The numbers say nobody, ${avg(leader[1].tw).toFixed(1)} a game.`))
  const seasonWins = new Map<string, number>()
  rs.forEach((r) => r.winners.forEach((id) => seasonWins.set(id, (seasonWins.get(id) ?? 0) + 1)))
  const heating = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.recent - x.season >= 2)
    .sort((x, y) => y.recent - y.season - (x.recent - x.season))[0]
  if (heating) add(abn(heating.id, ptsPick, heating.recent), heating.id, say(lastDate + heating.id + "heat", `${name(heating.id)} has scored ${heating.recent.toFixed(1)} a game over the last 3, up from ${heating.season.toFixed(1)} on the year.`, `${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} lately against ${heating.season.toFixed(1)} for the season.`, `Somebody should guard ${name(heating.id)} tonight. ${heating.recent.toFixed(1)} a game recently, ${heating.season.toFixed(1)} on the year.`))

  // Chasing a record.
  const book = recordBook(state)
  const pts = book.pts
  if (pts) {
    const near = [...per.entries()]
      .map(([id, v]) => ({ id, best: Math.max(0, ...v.pts) }))
      .filter((x) => x.best < pts.value && pts.value - x.best <= 2 && x.id !== pts.playerId)
      .sort((x, y) => y.best - x.best)[0]
    if (near) add(2.5, near.id, `${name(near.id)}'s best game, ${near.best}, is ${pts.value - near.best} shy of ${name(pts.playerId)}'s league record of ${pts.value} points. One good night and ${name(pts.playerId)} has to hear about it.`)
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
    add(1 + Math.abs(rival.aw - rival.bw) * 0.4, top, say(lastDate + top + "rival", `${name(top)} is ${tw}-${bw} against ${name(bottom)}.`, `${name(bottom)} keeps playing ${name(top)} and keeps losing: ${bw}-${tw}.`, `Think ${name(bottom)} can beat ${name(top)} tonight? They are ${bw}-${tw} all time.`))
  }

  // A milestone within reach.
  for (const [id, v] of per.entries()) {
    const gp = v.pts.length
    const next = [25, 50, 75, 100, 150, 200].find((m) => m > gp)
    if (next && next - gp <= 1 && gp >= 10) {
      add(1.2, id, `${name(id)} is ${next - gp === 1 ? "one game" : `${next - gp} games`} from ${next} played.`)
      break
    }
  }
  for (const [id, v] of per.entries()) {
    const total = v.pts.reduce((a, b) => a + b, 0)
    const next = Math.ceil((total + 1) / 100) * 100
    if (next - total <= 15 && total >= 100) {
      add(1.2, id, `${name(id)} is ${next - total} points from ${next} career points.`)
      break
    }
  }
  // The other side of the ledger.
  const winless = [...per.entries()].map(([id, v]) => ({ id, w: seasonWins.get(id) ?? 0, gp: v.pts.length })).filter((x) => x.w === 0 && x.gp >= 3)[0]
  if (winless) add(1.5 + winless.gp * 0.3, winless.id, say(lastDate + winless.id + "wl", `${name(winless.id)} is still looking for a first win.`, `When does ${name(winless.id)} get that first win?`, `${name(winless.id)} has not won a game yet, so the first one will be a big deal.`))
  const coldHand = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.season - x.recent >= 2)
    .sort((x, y) => y.season - y.recent - (x.season - x.recent))[0]
  if (coldHand) add(abn(coldHand.id, ptsPick, coldHand.recent), coldHand.id, say(lastDate + coldHand.id + "ch", `${name(coldHand.id)} has cooled off: ${coldHand.recent.toFixed(1)} points a game over the last 3, down from ${coldHand.season.toFixed(1)}.`, `What changed for ${name(coldHand.id)}? ${coldHand.recent.toFixed(1)} a game lately, ${coldHand.season.toFixed(1)} on the year.`, `${name(coldHand.id)} has scored ${coldHand.recent.toFixed(1)} a game lately, down from ${coldHand.season.toFixed(1)}, and is probably blaming something.`))
  const lastTw = [...per.entries()].filter(([, v]) => v.tw.length >= 3).sort((x, y) => avg(x[1].tw) - avg(y[1].tw))[0]
  if (lastTw && avg(lastTw[1].tw) < 0 && lastTw[0] !== leader?.[0]) add(1.5 + zAmong([...per.values()].filter((v) => v.tw.length >= 3).map((v) => avg(v.tw)), avg(lastTw[1].tw)), lastTw[0], say(lastDate + "rear", `${name(lastTw[0])} is last in two-way score at ${avg(lastTw[1].tw).toFixed(1)} a game.`, `${avg(lastTw[1].tw).toFixed(1)} two-way a game puts ${name(lastTw[0])} at the bottom of the league.`, `Their team is usually better off when ${name(lastTw[0])} is not on it: ${avg(lastTw[1].tw).toFixed(1)} two-way a game.`))
  return rank(items, 8)
}

// ---- the season so far ----------------------------------------------------------------------------------
export function seasonStories(state: PooleanState, name: Name): string[] {
  const since = state.currentSeasonStartedAt || ""
  const rs = results(state).filter((r) => !since || r.date >= since)
  const items: Item[] = []
  const add = (w: number, pid: string | null, text: string) => items.push({ w, pid, text })
  if (rs.length < 3) return []

  const dates = new Set(rs.map((r) => r.date))
  const totalPts = rs.reduce((n, r) => n + r.a + r.b, 0)
  add(0.5, null, `${plural(rs.length, "game")} over ${plural(dates.size, "night")} so far, ${totalPts} points scored.`)

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
  if (ranked[0]) add(4, ranked[0][0], say("pace" + ranked[0][0], `${name(ranked[0][0])} sets the pace at ${ranked[0][1].w}-${ranked[0][1].l} (${pct(winPct(ranked[0][1]))}%).`, `Everyone is chasing ${name(ranked[0][0])}, who leads at ${ranked[0][1].w}-${ranked[0][1].l}.`, `${ranked[0][1].w}-${ranked[0][1].l} for ${name(ranked[0][0])}, and nobody has caught up.`))
  if (ranked[1] && winPct(ranked[0][1]) - winPct(ranked[1][1]) <= 0.05) add(2.2, ranked[0][0], `${name(ranked[0][0])} and ${name(ranked[1][0])} are neck and neck for the top spot. Whoever loses next will hear about it.`)

  const scorer = [...all].sort((x, y) => y[1].pts - x[1].pts)[0]
  if (scorer && scorer[1].pts > 0) add(2 + zAmong(all.map(([, v]) => v.pts), scorer[1].pts), scorer[0], say("scorer" + scorer[0], `${name(scorer[0])} is the top scorer with ${scorer[1].pts} points, ${(scorer[1].pts / scorer[1].gp).toFixed(1)} a game.`, `${scorer[1].pts} points for ${name(scorer[0])}, the league's top scorer. Plenty of shots in there too.`, `Who scores the most? ${name(scorer[0])}, ${scorer[1].pts} points on the season.`))
  const tw = all.filter(([, v]) => v.tw.length >= 3).sort((x, y) => y[1].tw.reduce((a, b) => a + b, 0) / y[1].tw.length - x[1].tw.reduce((a, b) => a + b, 0) / x[1].tw.length)[0]
  if (tw) add(2, tw[0], `${name(tw[0])} leads in two-way score at ${(tw[1].tw.reduce((a, b) => a + b, 0) / tw[1].tw.length).toFixed(1)} a game, which means they score and defend. Annoying.`)

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
  if (b && b.n >= 4) add(b.n * 0.6, b.id, say("streak" + b.id, `${name(b.id)}'s ${b.n}-game win streak is the longest of the season.`, `${b.n} straight wins for ${name(b.id)}, the longest run so far, and the other side had the same chance to stop it.`, `The longest win streak of the season belongs to ${name(b.id)}: ${b.n}.`))

  const iron = [...all].sort((x, y) => y[1].gp - x[1].gp)[0]
  if (iron && iron[1].gp >= 5) add(1, iron[0], say("iron" + iron[0], `${name(iron[0])} has played in ${iron[1].gp} of ${rs.length} games, more than anyone.`, `Attendance leader: ${name(iron[0])}, ${iron[1].gp} of ${rs.length} games.`))

  // Bad news for the season.
  const last = ranked[ranked.length - 1]
  if (last && ranked.length >= 3) add(2, last[0], say("last" + last[0], `${name(last[0])} is last in the standings at ${last[1].w}-${last[1].l}.`, `${last[1].w}-${last[1].l} for ${name(last[0])}, the lowest win rate in the league.`, `Somebody has to be last, and so far it is ${name(last[0])} at ${last[1].w}-${last[1].l}.`))
  const toughest = rs.reduce((m, r) => (Math.abs(r.a - r.b) > Math.abs(m.a - m.b) ? r : m), rs[0])
  if (Math.abs(toughest.a - toughest.b) >= 10) add(Math.abs(toughest.a - toughest.b) / 5, null, say("blowout" + toughest.a, `The biggest blowout of the season was ${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, with ${toughest.losers.map(name).join(", ")} on the losing end.`, `${toughest.losers.map(name).join(", ")} lost ${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, the worst loss of the season. Nobody has asked for the replay.`))
  const turn = [...rec.keys()]
    .map((id) => {
      const lines = rs.filter((r) => [...r.game.teamA, ...r.game.teamB].includes(id)).map((r) => playerLine(r.game, id)).filter((l) => l.box)
      return { id, n: lines.length, tov: lines.reduce((a, l) => a + l.tov, 0) }
    })
    .filter((x) => x.n >= 3)
    .sort((x, y) => y.tov / y.n - x.tov / x.n)[0]
  if (turn && turn.tov / turn.n >= 1.5) add(1.5, turn.id, say("tov" + turn.id, `${name(turn.id)} leads the league in turnovers at ${(turn.tov / turn.n).toFixed(1)} a game.`, `${(turn.tov / turn.n).toFixed(1)} turnovers a game makes ${name(turn.id)} the league leader in giveaways.`, `Who gives the ball away most? ${name(turn.id)}, ${(turn.tov / turn.n).toFixed(1)} a game.`))
  return rank(items, 8, 3)
}

// ---- more headlines, good and bad -----------------------------------------------------------------------
const fg = (made: number, att: number) => `${made}-for-${att}`

// Extra headlines for a night, each handed to add() with its weight.
type Add = (w: number, pid: string | null, text: string) => void
type Abn = ((id: string, pick: (l: PlayerLine) => number, value: number) => number) & { mean: (id: string, pick: (l: PlayerLine) => number) => number | null }
const fgPick = (l: PlayerLine) => (l.fga >= 3 ? l.fgm / l.fga : NaN)
const tovPick = (l: PlayerLine) => (l.box ? l.tov : NaN)
const pfPick = (l: PlayerLine) => (l.box ? l.pf : NaN)
const blkPick = (l: PlayerLine) => (l.box ? l.blk : NaN)
const stlPick = (l: PlayerLine) => (l.box ? l.stl : NaN)
const twPick = (l: PlayerLine) => l.twoWay ?? NaN
const ptsPick = (l: PlayerLine) => l.pts

// How far a per-game value sits from what is normal for that player, in standard deviations, from games before
// the date. A player with fewer than 5 earlier games is compared with the whole league instead.
export function abnormality(state: PooleanState, date: string): Abn {
  const own = new Map<string, PlayerLine[]>()
  const league: PlayerLine[] = []
  for (const r of results(state)) {
    if (r.date >= date) continue
    for (const id of [...r.game.teamA, ...r.game.teamB]) {
      const l = playerLine(r.game, id)
      league.push(l)
      own.set(id, [...(own.get(id) ?? []), l])
    }
  }
  const sample = (id: string, pick: (l: PlayerLine) => number) => {
    const mine = (own.get(id) ?? []).map(pick).filter(Number.isFinite)
    return mine.length >= 5 ? mine : league.map(pick).filter(Number.isFinite)
  }
  const fn = (id: string, pick: (l: PlayerLine) => number, value: number) => {
    const xs = sample(id, pick)
    if (xs.length < 3) return 1
    const m = xs.reduce((a, b) => a + b, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)
    return Math.min(6, Math.max(0.3, Math.abs(value - m) / Math.max(sd, 0.1 * Math.max(Math.abs(m), 1))))
  }
  const mean = (id: string, pick: (l: PlayerLine) => number) => {
    const xs = sample(id, pick)
    return xs.length < 3 ? null : xs.reduce((a, b) => a + b, 0) / xs.length
  }
  return Object.assign(fn, { mean })
}

function extraNightStories(state: PooleanState, s: NightSummary, name: Name, add: Add, abn: Abn): void {
  const boxed = s.players.filter((p) => p.boxGames > 0)
  // " against a usual 41%" for a shooting line, from that player's own earlier games.
  const usualFg = (id: string) => {
    const m = abn.mean(id, fgPick)
    return m === null ? "" : ` against a usual ${Math.round(m * 100)}%`
  }

  // Shooting, hot and cold.
  const shooters = boxed.filter((p) => p.fga >= 6)
  const hot = [...shooters].sort((x, y) => y.fgm / y.fga - x.fgm / x.fga)[0]
  if (hot && hot.fgm / hot.fga >= 0.6) add(abn(hot.id, fgPick, hot.fgm / hot.fga), hot.id, labelLine(state, hot.id, "hot", { n: name(hot.id), fg: fg(hot.fgm, hot.fga) }, s.date) ?? say(s.date + hot.id + "fg", `${name(hot.id)} could not miss, ${fg(hot.fgm, hot.fga)} from the field${usualFg(hot.id)}.`, `Every shot ${name(hot.id)} took looked good. ${fg(hot.fgm, hot.fga)}.`, `${fg(hot.fgm, hot.fga)} for ${name(hot.id)}, and the defense is still trying to work out how.`))
  const cold = [...shooters].sort((x, y) => x.fgm / x.fga - y.fgm / y.fga)[0]
  if (cold && cold.fgm / cold.fga <= 0.3 && cold.id !== hot?.id) add(abn(cold.id, fgPick, cold.fgm / cold.fga), cold.id, labelLine(state, cold.id, "cold", { n: name(cold.id), fg: fg(cold.fgm, cold.fga) }, s.date) ?? say(s.date + cold.id + "fg", `${name(cold.id)} shot ${fg(cold.fgm, cold.fga)}${usualFg(cold.id)} and kept firing anyway.`, `Somebody take the ball from ${name(cold.id)}. ${fg(cold.fgm, cold.fga)}.`, `Was ${name(cold.id)} even looking at the rim? ${fg(cold.fgm, cold.fga)}.`, `${fg(cold.fgm, cold.fga)} for ${name(cold.id)}, and the other team never worried about it.`))

  // Rough nights.
  const worst = [...boxed].sort((x, y) => x.twoWay - y.twoWay)[0]
  if (worst && worst.twoWay < 0 && worst.id !== s.mvp?.id) add(abn(worst.id, twPick, worst.twoWay / worst.boxGames), worst.id, say(s.date + worst.id + "tw", `${name(worst.id)} was a net negative at ${worst.twoWay.toFixed(1)} two-way, which means their team did better with them sitting.`, `Their team was better off when ${name(worst.id)} sat down. Two-way score: ${worst.twoWay.toFixed(1)}.`, `Quick question for ${name(worst.id)}: how do you finish at ${worst.twoWay.toFixed(1)} two-way?`))
  const sloppy = [...boxed].sort((x, y) => y.tov - x.tov)[0]
  if (sloppy && sloppy.tov >= 4) add(abn(sloppy.id, tovPick, sloppy.tov / sloppy.boxGames), sloppy.id, labelLine(state, sloppy.id, "tov", { n: name(sloppy.id), k: sloppy.tov }, s.date) ?? say(s.date + sloppy.id + "tov", `${name(sloppy.id)} gave the ball away ${sloppy.tov} times, the most of anyone, and the other team said thank you each time.`, `${sloppy.tov} turnovers for ${name(sloppy.id)}. Passing to the wrong team counts as passing, technically.`, `Count the possessions the other team got for free from ${name(sloppy.id)} tonight: ${sloppy.tov}.`))
  const fouls = [...boxed].sort((x, y) => y.pf - x.pf)[0]
  if (fouls && fouls.pf >= 4) add(abn(fouls.id, pfPick, fouls.pf / fouls.boxGames), fouls.id, labelLine(state, fouls.id, "foul", { n: name(fouls.id), k: fouls.pf }, s.date) ?? say(s.date + fouls.id + "pf", `${name(fouls.id)} was whistled ${fouls.pf} times, the most of the night.`, `You can play defense without touching people, ${name(fouls.id)}. ${fouls.pf} fouls.`, `Nobody is officiating, so the group counted for ${name(fouls.id)}: ${fouls.pf} fouls.`))

  // Scoring droughts.
  const scoreless = s.players.filter((p) => p.games >= 2 && p.pts === 0)
  scoreless.forEach((p) => add(abn(p.id, ptsPick, 0), p.id, labelLine(state, p.id, "zero", { n: name(p.id), g: p.games }, s.date) ?? say(s.date + p.id + "zero", `${name(p.id)} did not score in ${plural(p.games, "game")}.`, `Nobody can remember ${name(p.id)} scoring tonight, and the box score agrees: zero in ${plural(p.games, "game")}.`, `${name(p.id)} played ${plural(p.games, "game")} and never got on the board.`, `Zero points for ${name(p.id)} across ${plural(p.games, "game")}. The team played short.`)))
  const quiet = [...s.players].filter((p) => p.games >= 3 && p.pts > 0).sort((x, y) => x.pts / x.games - y.pts / y.games)[0]
  if (quiet && quiet.pts / quiet.games <= 3) add(abn(quiet.id, ptsPick, quiet.pts / quiet.games), quiet.id, say(s.date + quiet.id + "q", `${name(quiet.id)} scored ${quiet.pts} in ${plural(quiet.games, "game")}. Barely noticeable.`, `Was ${name(quiet.id)} even there? ${quiet.pts} points in ${plural(quiet.games, "game")}.`))

  // Defense and hustle.
  const swat = [...boxed].sort((x, y) => y.blk - x.blk)[0]
  if (swat && swat.blk >= 3) add(abn(swat.id, blkPick, swat.blk / swat.boxGames), swat.id, say(s.date + swat.id + "blk", `${name(swat.id)} sent back ${swat.blk} shots tonight.`, `Nobody got an easy look at the rim with ${name(swat.id)} there: ${swat.blk} blocks.`, `${swat.blk} blocks for ${name(swat.id)}, and a few shooters will think about it later.`))
  const thief = [...boxed].sort((x, y) => y.stl - x.stl)[0]
  if (thief && thief.stl >= 4) add(abn(thief.id, stlPick, thief.stl / thief.boxGames), thief.id, say(s.date + thief.id + "stl", `${name(thief.id)} picked up ${thief.stl} steals, every one somebody else's mistake.`, `Watch your handle around ${name(thief.id)}: ${thief.stl} steals tonight.`, `${thief.stl} steals for ${name(thief.id)}, which is a lot of other people's turnovers.`))
  const dd = boxed.find((p) => p.pts >= 10 && p.reb >= 10)
  if (dd) add(2.5, dd.id, say(s.date + dd.id + "dd", `${name(dd.id)} had ${dd.pts} points and ${dd.reb} rebounds, a double-double, and will not stop mentioning it.`, `Double-double alert: ${name(dd.id)}, ${dd.pts} and ${dd.reb}.`))
  const dime = boxed.find((p) => p.pts >= 10 && p.ast >= 10)
  if (dime && dime.id !== dd?.id) add(2.5, dime.id, say(s.date + dime.id + "dm", `${name(dime.id)} scored ${dime.pts} and passed for ${dime.ast}, so the whole team ate.`, `${dime.pts} points and ${dime.ast} assists: ${name(dime.id)} was in every basket.`))

  // Bounce-backs and slumps, measured from before the night.
  const before = new Map(streaks(state, prevDate(state, s.date)).map((x) => [x.id, x]))
  for (const p of s.players) {
    const b = before.get(p.id)
    if (b && b.kind === "L" && b.n >= 3 && p.wins > 0) add(b.n * 0.6, p.id, say(s.date + p.id + "snap", `${name(p.id)} finally won again after ${b.n} losses in a row.`, `The ${b.n}-game losing streak is over for ${name(p.id)}.`, `Somebody get ${name(p.id)} a cake. The ${b.n} straight losses are done.`))
    if (b && b.kind === "W" && b.n >= 3 && p.wins === 0 && p.losses > 0) add(b.n * 0.6, p.id, say(s.date + p.id + "over", `${name(p.id)} lost for the first time in ${b.n} games.`, `The ${b.n}-game win streak ends tonight, and ${name(p.id)} is the one who has to explain it.`, `Streak over: ${name(p.id)} was beaten after ${b.n} straight wins.`))
  }

  // The blown-out side, named.
  const rout = s.biggestWin
  if (rout && Math.abs(rout.scoreA - rout.scoreB) >= 10) {
    const losers = rout.winner === "A" ? rout.teamB : rout.teamA
    add(Math.abs(rout.scoreA - rout.scoreB) / 5, null, say(s.date + "rout", `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}, the worst of the night.`, `Never in it: ${losers.map(name).join(", ")}, ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}.`, `${losers.map(name).join(", ")} got beat ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)} and probably want a rematch.`))
  }
  const cool = [...streaks(state, s.date)].filter((x) => x.kind === "L" && x.n === 3)
  cool.slice(0, 2).forEach((x) => add(1.2, x.id, say(s.date + x.id + "three", `${name(x.id)} has now dropped 3 in a row.`, `3 straight losses for ${name(x.id)}. Is everything okay?`, `${name(x.id)} is 0 for the last 3.`)))

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
    regulars.slice(0, 2).forEach(([id]) => add(1.5, id, labelLine(state, id, "noshow", { n: name(id) }, s.date) ?? say(s.date + id + "ns", `${name(id)} was not at the game. Somebody should text them.`, `Every regular was there except ${name(id)}.`, `Where was ${name(id)} tonight? Not here.`)))
  }

  // Personal: tonight against each player's own history.
  const hist = results(state).filter((r) => r.date < s.date)
  const prior = new Map<string, number[]>()
  for (const r of hist) {
    for (const id of [...r.game.teamA, ...r.game.teamB]) {
      const a = prior.get(id) ?? []
      a.push(playerLine(r.game, id).pts)
      prior.set(id, a)
    }
  }
  const swings = s.players
    .filter((p) => p.games >= 2 && (prior.get(p.id)?.length ?? 0) >= 6)
    .map((p) => {
      const ps = prior.get(p.id) as number[]
      const avg = ps.reduce((a, b) => a + b, 0) / ps.length
      return { p, avg, now: p.pts / p.games }
    })
  const up = swings.filter((x) => x.now >= x.avg * 1.5 && x.now - x.avg >= 3).sort((x, y) => y.now - y.avg - (x.now - x.avg))[0]
  if (up) add(abn(up.p.id, ptsPick, up.now), up.p.id, labelLine(state, up.p.id, "up", { n: name(up.p.id), pts: up.now.toFixed(1), avg: up.avg.toFixed(1) }, s.date) ?? say(s.date + up.p.id + "up", `${name(up.p.id)} averages ${up.avg.toFixed(1)} and scored ${up.now.toFixed(1)} a game tonight.`, `Where did that come from, ${name(up.p.id)}? ${up.now.toFixed(1)} a game against a usual ${up.avg.toFixed(1)}.`, `${name(up.p.id)} was a different player tonight, ${up.now.toFixed(1)} a game compared to the usual ${up.avg.toFixed(1)}.`))
  const down = swings.filter((x) => x.now <= x.avg * 0.5 && x.avg - x.now >= 3).sort((x, y) => y.avg - y.now - (x.avg - x.now))[0]
  if (down) add(abn(down.p.id, ptsPick, down.now), down.p.id, labelLine(state, down.p.id, "down", { n: name(down.p.id), pts: down.now.toFixed(1), avg: down.avg.toFixed(1) }, s.date) ?? say(s.date + down.p.id + "down", `${name(down.p.id)} scored ${down.now.toFixed(1)} a game tonight, well under their ${down.avg.toFixed(1)}.`, `Is ${name(down.p.id)} feeling alright? ${down.now.toFixed(1)} a game against a usual ${down.avg.toFixed(1)}.`, `Not ${name(down.p.id)}'s night: ${down.now.toFixed(1)} a game when ${down.avg.toFixed(1)} is normal.`))

  // Personal: results against a specific opponent, from everything before tonight.
  const seen = (a: string, b: string) => {
    let aw = 0
    let bw = 0
    for (const r of hist) {
      if (r.winners.includes(a) && r.losers.includes(b)) aw++
      else if (r.winners.includes(b) && r.losers.includes(a)) bw++
    }
    return { aw, bw }
  }
  const done = s.games.filter((g) => !g.live && g.winner)
  let gotOne = false
  let ownedAgain = false
  for (const g of done) {
    const winners = g.winner === "A" ? g.teamA : g.teamB
    const losers = g.winner === "A" ? g.teamB : g.teamA
    for (const w of winners) {
      for (const l of losers) {
        const { aw, bw } = seen(w, l)
        if (aw + bw < 4) continue
        if (!gotOne && bw - aw >= 2) {
          gotOne = true
          add(2 + (bw - aw) * 0.3, w, labelLine(state, w, "revenge", { n: name(w), o: name(l), r: `${aw + 1}-${bw}` }, s.date) ?? say(s.date + w + l + "rev", `${name(w)} finally got one back on ${name(l)}, ${aw + 1}-${bw} all time.`, `${name(l)} lost to ${name(w)} tonight, which does not happen much: ${bw} to ${aw + 1} all time.`))
        } else if (!ownedAgain && aw - bw >= 2) {
          ownedAgain = true
          add(2 + (aw - bw) * 0.3, l, labelLine(state, l, "owned", { n: name(l), o: name(w), r: `${bw}-${aw + 1}` }, s.date) ?? say(s.date + w + l + "own", `${name(l)} lost to ${name(w)} again, ${bw}-${aw + 1} all time.`, `Every time ${name(w)} plays ${name(l)}, the same thing happens. ${aw + 1}-${bw}.`, `${name(w)} has ${name(l)} figured out: ${aw + 1}-${bw} all time.`))
        }
      }
    }
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
    if (tonightAvg > Math.max(...others)) add(2, null, say(s.date + "high", `${tonightAvg.toFixed(1)} points a game tonight, the highest of any night, so nobody was playing defense.`, `Highest-scoring night yet: ${tonightAvg.toFixed(1)} a game.`, `Defense took the night off: ${tonightAvg.toFixed(1)} points a game, a new high.`))
    else if (tonightAvg < Math.min(...others)) add(2, null, say(s.date + "low", `Lowest-scoring night yet, ${tonightAvg.toFixed(1)} a game.`, `${tonightAvg.toFixed(1)} points a game. Everyone was cold.`, `Fewest points of any night so far: ${tonightAvg.toFixed(1)} a game.`))
  }
}

// The night before a date, for streaks as they stood going in.
function prevDate(state: PooleanState, date: string): string {
  const days = [...new Set(state.games.filter((g) => g.date && g.date < date).map((g) => g.date))].sort()
  return days[days.length - 1] ?? ""
}
