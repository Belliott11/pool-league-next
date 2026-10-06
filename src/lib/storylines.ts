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
    out.push(labelLine(state, s.mvp.id, "mvp", { n: name(s.mvp.id), pts: s.mvp.pts }, s.date) ?? say(s.date + "mvp", `${name(s.mvp.id)} was the MVP with ${s.mvp.pts} points and a ${s.mvp.twoWay.toFixed(1)} two-way score. The rest of you were there too.`, `MVP of the night: ${name(s.mvp.id)}, ${s.mvp.pts} points. Nobody else made a real case.`, `${name(s.mvp.id)} was the best player on the court tonight, ${s.mvp.pts} points and ${s.mvp.twoWay.toFixed(1)} two-way. Enjoy it, you will hear about it all week.`))
  }

  for (const p of s.players) {
    if (p.games >= 3 && p.losses === 0) out.push(labelLine(state, p.id, "sweep", { n: name(p.id), w: p.wins }, s.date) ?? say(s.date + p.id + "sweep", `${name(p.id)} went ${p.wins}-0 and never lost. Expect a speech.`, `${p.wins}-0 for ${name(p.id)}. Somebody has to start picking them last.`, `${name(p.id)} won all ${p.wins} games. Nobody on the other side wants to talk about it.`, `${name(p.id)} ran the whole night like it was their pool.`))
    else if (p.games >= 3 && p.wins === 0) out.push(labelLine(state, p.id, "winless", { n: name(p.id), l: p.losses }, s.date) ?? say(s.date + p.id + "winless", `${name(p.id)} went 0-${p.losses}. Might as well have stayed home.`, `${name(p.id)} lost all ${p.losses} games tonight. The teams were better off without them.`, `0-${p.losses} for ${name(p.id)}. Pick them last, you already know why.`, `${name(p.id)} spent the night in the deep end without floaties, 0-${p.losses}.`))
  }

  for (const c of callouts.filter((x) => x.kind === "record")) {
    out.push(say(s.date + c.playerId + c.key, `New league record: ${name(c.playerId)} had ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} in a game, topping ${c.previous}${c.holderId ? ` from ${name(c.holderId)}, who can start making excuses` : ""}.`, `${name(c.playerId)} owns the ${RECORD_LABEL[c.key].toLowerCase()} record now with ${c.value}. The old mark was ${c.previous}${c.holderId ? `, and ${name(c.holderId)} had it all to themselves until tonight` : ""}.`))
  }
  // A tie only makes a story when the mark is big enough to mean something.
  for (const c of callouts.filter((x) => x.kind === "tied" && x.value >= 3)) {
    out.push(say(s.date + c.playerId + c.key + "tie", `${name(c.playerId)} tied the league ${RECORD_LABEL[c.key].toLowerCase()} record at ${c.value}. Close enough to brag, not close enough to count.`, `${name(c.playerId)} matched the ${RECORD_LABEL[c.key].toLowerCase()} record of ${c.value}. One more and the record would have been theirs alone.`))
  }
  for (const c of callouts.filter((x) => x.kind === "careerHigh")) {
    out.push(say(s.date + c.playerId + "ch", `Career high for ${name(c.playerId)}: ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}, up from ${c.previous}. About time.`, `${name(c.playerId)} had a personal best ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}. The old best was ${c.previous}, so this one is only fair.`))
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
      out.push(say(s.date + "upset", `Upset: ${winners.map(name).join(", ")} won ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)} with only a ${pct(u.chance)}% chance going in. The other team should have seen the odds and still lost.`, `${winners.map(name).join(", ")} beat the ${pct(u.chance)}% odds, ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)}. The favorites will say it was a fluke.`, `Giant slayers: ${winners.map(name).join(", ")} won ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)} at ${pct(u.chance)}% odds. Classic David and Goliath.`))
    }
  }

  if (s.closest && Math.abs(s.closest.scoreA - s.closest.scoreB) <= 2) {
    out.push(say(s.date + "close", `Decided by ${Math.abs(s.closest.scoreA - s.closest.scoreB)}, ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. The losers are already listing the calls that went wrong.`, `The closest game of the night finished ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. One shot either way and the arguing would be on the other side.`, `${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. A coin flip would have been less stressful.`))
  }
  if (s.biggestWin && Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) >= 10) {
    out.push(`${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won by ${Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB)}. The other team knew by halftime.`)
  }

  const hot = streaks(state, s.date).filter((x) => x.kind === "W" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (hot) out.push(labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, s.date) ?? say(s.date + hot.id + "hot", `${name(hot.id)} has won ${hot.n} straight. Nobody has figured out how to stop them yet.`, `${name(hot.id)} is on a ${hot.n}-game win streak and has been insufferable about it.`))
  const cold = streaks(state, s.date).filter((x) => x.kind === "L" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (cold) out.push(labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, s.date) ?? say(s.date + cold.id + "cold", `${name(cold.id)} has lost ${cold.n} straight. At some point it is not bad luck.`, `${cold.n} losses in a row for ${name(cold.id)}. Teams are starting to call them first, as a favor to themselves.`))

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
  if (bestWin && bestWin[1] >= 2) out.push(say(lastDate + "last", `Last time out, ${name(bestWin[0])} won ${bestWin[1]} of ${plural(last.length, "game")} and has been talking about it since.`, `${name(bestWin[0])} took ${bestWin[1]} of ${plural(last.length, "game")} last time. Everyone else wants a rematch.`))

  const run = streaks(state)
  const hot = run.filter((x) => x.kind === "W" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (hot) out.push(labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, lastDate) ?? say(lastDate + hot.id + "hot", `${name(hot.id)} comes in on a ${hot.n}-game win streak. Somebody has to guard them eventually.`, `${name(hot.id)} has won ${hot.n} straight, so tonight everyone gets to try to beat them.`))
  const cold = run.filter((x) => x.kind === "L" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (cold) out.push(labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, lastDate) ?? say(lastDate + cold.id + "cold", `${name(cold.id)} comes in on a ${cold.n}-game losing streak. Their teammates are hoping for a different result.`, `${name(cold.id)} has lost ${cold.n} in a row and needs a win. So does whoever gets them on their team.`))

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
  if (leader) out.push(say(lastDate + "lead", `${name(leader[0])} leads the league in two-way score at ${avg(leader[1].tw).toFixed(1)} a game. They will not let you forget it.`, `${avg(leader[1].tw).toFixed(1)} two-way a game makes ${name(leader[0])} the best all-around player so far, and they know it.`))
  const seasonWins = new Map<string, number>()
  rs.forEach((r) => r.winners.forEach((id) => seasonWins.set(id, (seasonWins.get(id) ?? 0) + 1)))
  const heating = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.recent - x.season >= 2)
    .sort((x, y) => y.recent - y.season - (x.recent - x.season))[0]
  if (heating) out.push(say(lastDate + heating.id + "heat", `${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} points a game over the last 3, up from ${heating.season.toFixed(1)}. Someone should guard them tonight.`, `${name(heating.id)} has scored ${heating.recent.toFixed(1)} a game lately, up from ${heating.season.toFixed(1)}. Whoever draws them should be nervous.`))

  // Chasing a record.
  const book = recordBook(state)
  const pts = book.pts
  if (pts) {
    const near = [...per.entries()]
      .map(([id, v]) => ({ id, best: Math.max(0, ...v.pts) }))
      .filter((x) => x.best < pts.value && pts.value - x.best <= 2 && x.id !== pts.playerId)
      .sort((x, y) => y.best - x.best)[0]
    if (near) out.push(`${name(near.id)}'s best game, ${near.best}, is ${pts.value - near.best} shy of ${name(pts.playerId)}'s league record of ${pts.value} points. One good night and ${name(pts.playerId)} has to hear about it.`)
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
    out.push(say(lastDate + top + "rival", `${name(top)} is ${tw}-${bw} against ${name(bottom)}. ${name(bottom)} keeps asking for another game, which is not helping.`, `${name(bottom)} is ${bw}-${tw} against ${name(top)}. At this point it is less a rivalry and more a habit.`))
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
  if (winless) out.push(say(lastDate + winless.id + "wl", `${name(winless.id)} is still looking for a first win. Their teams are looking for a new teammate.`, `${name(winless.id)} has not won a game yet, so the first one is going to get a lot of attention.`))
  const coldHand = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.season - x.recent >= 2)
    .sort((x, y) => y.season - y.recent - (x.season - x.recent))[0]
  if (coldHand) out.push(say(lastDate + coldHand.id + "ch", `${name(coldHand.id)} has cooled off: ${coldHand.recent.toFixed(1)} points a game over the last 3, down from ${coldHand.season.toFixed(1)}. Something changed and it was not for the better.`, `${name(coldHand.id)} has scored ${coldHand.recent.toFixed(1)} a game lately, down from ${coldHand.season.toFixed(1)}. They are guarding better than they are shooting.`))
  const lastTw = [...per.entries()].filter(([, v]) => v.tw.length >= 3).sort((x, y) => avg(x[1].tw) - avg(y[1].tw))[0]
  if (lastTw && avg(lastTw[1].tw) < 0 && lastTw[0] !== leader?.[0]) out.push(say(lastDate + "rear", `${name(lastTw[0])} is last in two-way score at ${avg(lastTw[1].tw).toFixed(1)} a game. That means their team is better off when they sit.`, `${avg(lastTw[1].tw).toFixed(1)} two-way a game puts ${name(lastTw[0])} at the bottom of the league. The math is not kind.`))
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
  if (ranked[0]) out.push(say("pace" + ranked[0][0], `${name(ranked[0][0])} sets the pace at ${ranked[0][1].w}-${ranked[0][1].l} (${pct(winPct(ranked[0][1]))}%). Everyone else is playing for second.`, `${name(ranked[0][0])} leads the league at ${ranked[0][1].w}-${ranked[0][1].l} and will not stop bringing it up.`))
  if (ranked[1] && winPct(ranked[0][1]) - winPct(ranked[1][1]) <= 0.05) out.push(`${name(ranked[0][0])} and ${name(ranked[1][0])} are neck and neck for the top spot. Whoever loses next will hear about it.`)

  const scorer = [...all].sort((x, y) => y[1].pts - x[1].pts)[0]
  if (scorer && scorer[1].pts > 0) out.push(say("scorer" + scorer[0], `${name(scorer[0])} is the top scorer with ${scorer[1].pts} points, ${(scorer[1].pts / scorer[1].gp).toFixed(1)} a game. That is a lot of shots.`, `${scorer[1].pts} points for ${name(scorer[0])}, the league's top scorer. Whether that is good or just a lot of shots is up for debate.`))
  const tw = all.filter(([, v]) => v.tw.length >= 3).sort((x, y) => y[1].tw.reduce((a, b) => a + b, 0) / y[1].tw.length - x[1].tw.reduce((a, b) => a + b, 0) / x[1].tw.length)[0]
  if (tw) out.push(`${name(tw[0])} leads in two-way score at ${(tw[1].tw.reduce((a, b) => a + b, 0) / tw[1].tw.length).toFixed(1)} a game, which means they score and defend. Annoying.`)

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
  if (b && b.n >= 4) out.push(`${name(b.id)}'s ${b.n}-game win streak is the longest of the season. Somebody should have stopped them sooner.`)

  const iron = [...all].sort((x, y) => y[1].gp - x[1].gp)[0]
  if (iron && iron[1].gp >= 5) out.push(`${name(iron[0])} has played in ${iron[1].gp} of ${rs.length} games, more than anyone. Either dedicated or has nothing else going on.`)

  // Bad news for the season.
  const last = ranked[ranked.length - 1]
  if (last && ranked.length >= 3) out.push(say("last" + last[0], `${name(last[0])} is last in the standings at ${last[1].w}-${last[1].l}. Someone has to be.`, `${last[1].w}-${last[1].l} for ${name(last[0])}, the lowest win rate in the league. Pick them last until they prove otherwise.`, `${name(last[0])} is anchoring the standings at ${last[1].w}-${last[1].l}.`))
  const toughest = rs.reduce((m, r) => (Math.abs(r.a - r.b) > Math.abs(m.a - m.b) ? r : m), rs[0])
  if (Math.abs(toughest.a - toughest.b) >= 10) out.push(`The biggest blowout of the season was ${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, with ${toughest.losers.map(name).join(", ")} on the losing end. They have not brought it up since.`)
  const turn = [...rec.keys()]
    .map((id) => {
      const lines = rs.filter((r) => [...r.game.teamA, ...r.game.teamB].includes(id)).map((r) => playerLine(r.game, id)).filter((l) => l.box)
      return { id, n: lines.length, tov: lines.reduce((a, l) => a + l.tov, 0) }
    })
    .filter((x) => x.n >= 3)
    .sort((x, y) => y.tov / y.n - x.tov / x.n)[0]
  if (turn && turn.tov / turn.n >= 1.5) out.push(say("tov" + turn.id, `${name(turn.id)} leads the league in turnovers at ${(turn.tov / turn.n).toFixed(1)} a game. The other team loves having them around.`, `${(turn.tov / turn.n).toFixed(1)} turnovers a game makes ${name(turn.id)} the league leader in giveaways. The other team thanks them.`))
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
  if (hot && hot.fgm / hot.fga >= 0.6) good.push(labelLine(state, hot.id, "hot", { n: name(hot.id), fg: fg(hot.fgm, hot.fga) }, s.date) ?? say(s.date + hot.id + "fg", `${name(hot.id)} shot ${fg(hot.fgm, hot.fga)} from the field. Nobody could guard them and nobody tried hard enough.`, `${fg(hot.fgm, hot.fga)} from the field for ${name(hot.id)}, easily the best shooting of the night.`, `${name(hot.id)} shot ${fg(hot.fgm, hot.fga)}. The rim looked as big as the pool tonight.`))
  const cold = [...shooters].sort((x, y) => x.fgm / x.fga - y.fgm / y.fga)[0]
  if (cold && cold.fgm / cold.fga <= 0.3 && cold.id !== hot?.id) bad.push(labelLine(state, cold.id, "cold", { n: name(cold.id), fg: fg(cold.fgm, cold.fga) }, s.date) ?? say(s.date + cold.id + "fg", `${name(cold.id)} went ${fg(cold.fgm, cold.fga)} from the field. That is a lot of shots for that many misses.`, `${name(cold.id)} shot ${fg(cold.fgm, cold.fga)} and never stopped shooting. Confidence is great, results are better.`, `${fg(cold.fgm, cold.fga)} for ${name(cold.id)}. The other team was happy to let them keep shooting.`, `${name(cold.id)} shot ${fg(cold.fgm, cold.fga)}. The rim was closed for business.`))

  // Rough nights.
  const worst = [...boxed].sort((x, y) => x.twoWay - y.twoWay)[0]
  if (worst && worst.twoWay < 0 && worst.id !== s.mvp?.id) bad.push(say(s.date + worst.id + "tw", `${name(worst.id)} had a two-way score of ${worst.twoWay.toFixed(1)}, the lowest of the night. Their team would have been better off playing a man down.`, `${name(worst.id)} was a net negative at ${worst.twoWay.toFixed(1)} two-way. The scoreboard did better when they sat.`))
  const sloppy = [...boxed].sort((x, y) => y.tov - x.tov)[0]
  if (sloppy && sloppy.tov >= 4) bad.push(labelLine(state, sloppy.id, "tov", { n: name(sloppy.id), k: sloppy.tov }, s.date) ?? say(s.date + sloppy.id + "tov", `${name(sloppy.id)} had ${sloppy.tov} turnovers, the most of the night. That is ${sloppy.tov} free possessions for the other team.`, `${sloppy.tov} turnovers for ${name(sloppy.id)}. Handing it over is not a strategy.`, `${name(sloppy.id)} had ${sloppy.tov} turnovers. Basically gift-wrapped possessions for the other team.`))
  const fouls = [...boxed].sort((x, y) => y.pf - x.pf)[0]
  if (fouls && fouls.pf >= 4) bad.push(labelLine(state, fouls.id, "foul", { n: name(fouls.id), k: fouls.pf }, s.date) ?? say(s.date + fouls.id + "pf", `${name(fouls.id)} was called for ${fouls.pf} fouls, the most of the night. Defense, but the illegal kind.`, `${fouls.pf} fouls for ${name(fouls.id)}. Try playing defense without touching anyone.`))

  // Scoring droughts.
  const scoreless = s.players.filter((p) => p.games >= 2 && p.pts === 0)
  scoreless.forEach((p) => bad.push(labelLine(state, p.id, "zero", { n: name(p.id), g: p.games }, s.date) ?? say(s.date + p.id + "zero", `${name(p.id)} did not score in ${plural(p.games, "game")}. Hard to do on purpose.`, `${name(p.id)} played ${plural(p.games, "game")} and never scored. Their team played with four.`, `${name(p.id)} played ${plural(p.games, "game")} and the scoreboard never heard their name.`)))
  const quiet = [...s.players].filter((p) => p.games >= 3 && p.pts > 0).sort((x, y) => x.pts / x.games - y.pts / y.games)[0]
  if (quiet && quiet.pts / quiet.games <= 3) bad.push(`${name(quiet.id)} had a quiet night: ${quiet.pts} points in ${plural(quiet.games, "game")}. Were they there the whole time?`)

  // Defense and hustle.
  const swat = [...boxed].sort((x, y) => y.blk - x.blk)[0]
  if (swat && swat.blk >= 3) good.push(say(s.date + swat.id + "blk", `${name(swat.id)} blocked ${swat.blk} shots. Nobody got an easy one at the rim.`, `${swat.blk} blocks for ${name(swat.id)}. The shooters will think twice next time.`))
  const thief = [...boxed].sort((x, y) => y.stl - x.stl)[0]
  if (thief && thief.stl >= 4) good.push(say(s.date + thief.id + "stl", `${name(thief.id)} had ${thief.stl} steals. Ball handlers had a bad night.`, `${thief.stl} steals for ${name(thief.id)}, and every one of them was somebody else's mistake.`))
  const dd = boxed.find((p) => p.pts >= 10 && p.reb >= 10)
  if (dd) good.push(`${name(dd.id)} had a double-double: ${dd.pts} points and ${dd.reb} rebounds. Show-off.`)
  const dime = boxed.find((p) => p.pts >= 10 && p.ast >= 10)
  if (dime && dime.id !== dd?.id) good.push(`${name(dime.id)} had ${dime.pts} points and ${dime.ast} assists. Scores and passes, which is annoying.`)

  // Bounce-backs and slumps, measured from before the night.
  const before = new Map(streaks(state, prevDate(state, s.date)).map((x) => [x.id, x]))
  for (const p of s.players) {
    const b = before.get(p.id)
    if (b && b.kind === "L" && b.n >= 3 && p.wins > 0) good.push(say(s.date + p.id + "snap", `${name(p.id)} finally ended a ${b.n}-game losing streak. About time.`, `${name(p.id)} won tonight after ${b.n} straight losses. Teammates are relieved.`))
    if (b && b.kind === "W" && b.n >= 3 && p.wins === 0 && p.losses > 0) bad.push(say(s.date + p.id + "over", `${name(p.id)} lost tonight, ending a ${b.n}-game win streak. Everyone else is happy about it.`, `${name(p.id)}'s ${b.n}-game win streak is over. Somebody finally figured them out.`))
  }

  // The blown-out side, named.
  const rout = s.biggestWin
  if (rout && Math.abs(rout.scoreA - rout.scoreB) >= 10) {
    const losers = rout.winner === "A" ? rout.teamB : rout.teamA
    bad.push(say(s.date + "rout", `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}, the biggest blowout of the night. It was over early.`, `${losers.map(name).join(", ")} got blown out, ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}. They will blame the teams.`, `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}. The other side was running a clinic.`))
  }
  const cool = [...streaks(state, s.date)].filter((x) => x.kind === "L" && x.n === 3)
  cool.slice(0, 2).forEach((x) => bad.push(say(s.date + x.id + "three", `${name(x.id)} has now lost 3 in a row. It is starting to look like a pattern.`, `3 straight losses for ${name(x.id)}. Their teammates are starting to notice.`)))

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
    regulars.slice(0, 2).forEach(([id]) => bad.push(labelLine(state, id, "noshow", { n: name(id) }, s.date) ?? say(s.date + id + "ns", `${name(id)} was not there tonight and usually is. Somebody should check on them, or at least text them.`, `${name(id)} missed the night. Their teams had to find someone else to blame.`)))
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
    if (tonightAvg > Math.max(...others)) good.push(`The highest-scoring night yet at ${tonightAvg.toFixed(1)} points a game. Nobody played much defense.`)
    else if (tonightAvg < Math.min(...others)) bad.push(say(s.date + "low", `The lowest-scoring night on record, ${tonightAvg.toFixed(1)} points a game. Everyone was cold.`, `${tonightAvg.toFixed(1)} points a game, the fewest of any night. Not a lot of shooting talent on display.`))
  }
  return { good, bad }
}

// The night before a date, for streaks as they stood going in.
function prevDate(state: PooleanState, date: string): string {
  const days = [...new Set(state.games.filter((g) => g.date && g.date < date).map((g) => g.date))].sort()
  return days[days.length - 1] ?? ""
}
