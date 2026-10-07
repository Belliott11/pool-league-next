import { injuryBoard, statusInfo } from "@/lib/injuries"
import { pick } from "@/lib/pick"
import { forPlayer } from "@/lib/pronouns"
import { finalSet, isHidden, labelLine, LINE_CAP, lineKey, lineSink, weighted } from "@/lib/labels"
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
// The wordings the last say() could have used, so the story it ends up in can swap to another one if that makes the
// list less samey (see rank).
let lastOptions: string[] = []
export const say = (seed: string, ...options: string[]): string => {
  // A wording the editor thumbed down is skipped when another one is available.
  lineSink.current?.(options)
  const live = options.filter((o) => !isHidden(o))
  const pool = finalSet(live.length ? live : options, LINE_CAP.recap)
  lastOptions = pool
  return pick(seed, weighted(pool))
}
// Adds a candidate story, remembering the other wordings it could have had.
export const adder = (items: Item[]) => (w: number, pid: string | null, text: string) => items.push({ w, pid, text, alts: lastOptions.includes(text) ? lastOptions.filter((o) => o !== text) : [] })

// Candidate headlines come with a weight for how unusual they are; the most unusual go first, no player gets more
// than two (three on the season card), and anything the editor removed is dropped.
export type Item = { w: number; pid: string | null; text: string; alts?: string[] }
// How a line begins and how it is built, so a list does not open every line the same way or use the same trick twice.
const opener = (t: string) => lineKey(t).split(" ").slice(0, 2).join(" ").toLowerCase()
const build = (t: string) => (t.includes("?") ? "question" : /, which /.test(t) ? "which" : /\. /.test(t) ? "two-part" : "single")
// The wording with names, numbers and the stat's name blanked out: two lines with the same skeleton are the same template
// ("12 points ties the record for Adam" and "4 assists ties the record for Alex").
const skeleton = (t: string) => lineKey(t).replace(/\b(points?|rebounds?|assists?|steals?|blocks?|threes?|three-pointers?|turnovers?|fouls?)\b/gi, "S")
export function rank(items: Item[], limit: number, perPlayerMax = 2): string[] {
  const perPlayer = new Map<string, number>()
  const openers = new Set<string>()
  const skeletons = new Set<string>()
  const builds = new Map<string, number>()
  const chosen: string[] = []
  for (const it of items.sort((x, y) => y.w - x.w)) {
    if (it.pid) {
      const n = (perPlayer.get(it.pid) ?? 0) + 1
      perPlayer.set(it.pid, n)
      if (n > perPlayerMax) continue
    }
    // A template that is already in the list is not used again: another wording of the same story is taken, or the line is skipped.
    const options = [it.text, ...(it.alts ?? [])].filter((o) => !isHidden(o) && !skeletons.has(skeleton(o)))
    if (options.length === 0) continue
    // Prefer the wording that starts differently from the ones already chosen, and has not been used much.
    const fresh = options.filter((o) => !openers.has(opener(o)))
    const best = fresh.find((o) => (builds.get(build(o)) ?? 0) < 2) ?? fresh[0] ?? options[0]
    openers.add(opener(best))
    skeletons.add(skeleton(best))
    builds.set(build(best), (builds.get(build(best)) ?? 0) + 1)
    chosen.push(forPlayer(it.pid, best))
    if (chosen.length >= limit) break
  }
  return chosen.filter((x) => !isHidden(x))
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
  const add = adder(items)
  const abn = abnormality(state, s.date)
  const done = s.games.filter((g) => !g.live && g.winner)

  if (s.mvp && s.mvp.boxGames > 0) {
    add(99, s.mvp.id, labelLine(state, s.mvp.id, "mvp", { n: name(s.mvp.id), pts: s.mvp.pts }, s.date) ?? say(s.date + "mvp", `Was there ever any doubt? ${name(s.mvp.id)} took MVP and the rest of the group took notes, or should have.`, `${name(s.mvp.id)} won MVP with ${s.mvp.pts} points, which means you will hear about it until the next game.`, `${name(s.mvp.id)} is MVP with ${s.mvp.pts} points and ${s.mvp.twoWay.toFixed(1)} two-way, and has already started explaining how it felt.`, `${name(s.mvp.id)} won MVP at ${s.mvp.pts} points. The other ${s.players.length - 1} players split the credit for being there.`, `MVP: ${name(s.mvp.id)}, ${s.mvp.pts} points. The rest of the group played too, in the sense of being on the court.`, `${name(s.mvp.id)} was the best player tonight, ${s.mvp.pts} points, and the group will now take turns pretending not to be annoyed.`, `${name(s.mvp.id)} gets MVP at ${s.mvp.pts} points. Anyone who wants to dispute it can start with the box score.`, `Nobody is arguing ${name(s.mvp.id)} for MVP at ${s.mvp.pts} points, which is rare for this group.`, `${name(s.mvp.id)} took MVP with ${s.mvp.pts} points, and several people are checking the box score for a recount.`, `${s.mvp.pts} points and the MVP for ${name(s.mvp.id)}. Whoever guarded them can discuss it privately.`, `${name(s.mvp.id)} is MVP with ${s.mvp.pts} points and will be carried out of the yard on a door.`, `${name(s.mvp.id)} won MVP at ${s.mvp.pts} points, and a statue is being discussed.`, `${name(s.mvp.id)} won MVP at ${s.mvp.pts} points and is being carried to the deep end for a ceremony.`))
  }

  for (const p of s.players) {
    if (p.games >= 3 && p.losses === 0) add(1.5 + p.games * 0.4, p.id, labelLine(state, p.id, "sweep", { n: name(p.id), w: p.wins }, s.date) ?? say(s.date + p.id + "sweep", `Nobody got a win off ${name(p.id)} tonight. ${p.wins} games, ${p.wins} wins, zero mercy.`, `${name(p.id)} went ${p.wins}-0 and nobody had the nerve to ask for a different team.`, `${p.wins}-0 for ${name(p.id)}, so the only way to beat them was to not play them.`, `${p.wins}-0 for ${name(p.id)}, and the group chat will hear about it before the cooler is even opened.`, `${name(p.id)} went ${p.wins}-0 and has already started the story, and it only gets longer.`, `Who keeps picking ${name(p.id)}'s teams? ${p.wins}-0 says keep doing it.`, `${name(p.id)} won all ${p.wins}, which makes whoever picked the teams either a genius or very lucky.`, `${name(p.id)}'s losses tonight: none. ${name(p.id)}'s wins: ${p.wins}.`, `Count ${name(p.id)}'s losses tonight. That is the whole joke, because the number is zero.`, `${p.wins}-0 for ${name(p.id)}, who is now the only person who can talk about tonight with a straight face.`, `${name(p.id)} went ${p.wins}-0 and everyone else went home with a story about how it was close.`, `${name(p.id)} finished ${p.wins}-0 and made the other teams look optional.`, `${name(p.id)} swept ${p.wins} games and has yet to be asked a hard question about it.`, `${name(p.id)} went ${p.wins}-0, which means the next game they play is going to start with a speech.`, `${name(p.id)} won every game tonight. Somebody check the shoes for a cheat code.`, `${name(p.id)} went ${p.wins}-0 and has been politely asked to leave the neighborhood for being too good.`, `${p.wins}-0 for ${name(p.id)}, who is now legally required to be humble and will fail.`, `${name(p.id)} went ${p.wins}-0, and the pool has asked for a rematch with a different pool.`, `${p.wins}-0 for ${name(p.id)}, who is now being treated as the pool owner.`))
    else if (p.games >= 3 && p.wins === 0) add(1.5 + p.games * 0.4, p.id, labelLine(state, p.id, "winless", { n: name(p.id), l: p.losses }, s.date) ?? say(s.date + p.id + "winless", `${name(p.id)} went 0-${p.losses}. A coin would have won one by now.`, `${name(p.id)} went 0-${p.losses} and still had the nerve to ask for the ball.`, `How do you lose all ${p.losses} games? Ask ${name(p.id)}, they just did it.`, `${p.losses} games, ${p.losses} losses, and ${name(p.id)} is already planning to blame the teams.`, `${name(p.id)} went 0-${p.losses}. The scoreboard is not being unfair, it is being accurate.`, `${name(p.id)} lost ${p.losses} games out of ${p.losses}, which takes real commitment.`, `${name(p.id)} went 0-${p.losses}, which scientists describe as statistically impressive.`, `${name(p.id)} went 0-${p.losses}, which is how you know the deep end was involved.`))
  }

  for (const c of callouts.filter((x) => x.kind === "record")) {
    add(4.5, c.playerId, say(s.date + c.playerId + c.key, `${name(c.playerId)} put up ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} for a new league record${c.holderId ? ", wiping out " + name(c.holderId) + "'s " + c.previous + ", which they were very proud of until about an hour ago" : ""}.`, `${name(c.playerId)} now holds the ${RECORD_LABEL[c.key].toLowerCase()} record at ${c.value}${c.holderId ? ", and " + name(c.holderId) + " is reportedly looking for a recount, a lawyer, or both" : ""}.`, `New league ${RECORD_LABEL[c.key].toLowerCase()} record: ${c.value} for ${name(c.playerId)}${c.holderId ? ". " + name(c.holderId) + "'s " + c.previous + " is being quietly taken down from the wall" : ""}.`, `${c.holderId ? name(c.holderId) + " had the " + RECORD_LABEL[c.key].toLowerCase() + " record at " + c.previous + ". " + name(c.playerId) + " has it at " + c.value + ". That is the whole story and it hurts." : name(c.playerId) + " set the " + RECORD_LABEL[c.key].toLowerCase() + " record at " + c.value + ", with nobody to take it from."}`, `${name(c.playerId)} made it ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} and took the league record, and the old ${c.previous} has been moved to the display case.`))
  }
  // A tie only makes a story when the mark is big enough to mean something.
  for (const c of callouts.filter((x) => x.kind === "tied" && x.value >= 3)) {
    add(2.5, c.playerId, say(s.date + c.playerId + c.key + "tie", `${name(c.playerId)} matched the ${RECORD_LABEL[c.key].toLowerCase()} record of ${c.value}, and will spend the week insisting that counts.`, `${c.value} ${RECORD_LABEL[c.key].toLowerCase()} ties the record for ${name(c.playerId)}, which is how you almost make history.`, `One more and ${name(c.playerId)} would have owned the ${RECORD_LABEL[c.key].toLowerCase()} record alone. A tie at ${c.value} is the participation trophy of records.`, `Tied for the ${RECORD_LABEL[c.key].toLowerCase()} record at ${c.value}. ${name(c.playerId)} would like the group to say the number out loud, slowly.`, `${c.value} ${RECORD_LABEL[c.key].toLowerCase()} gets ${name(c.playerId)} half of a record, which is the kind that comes with no trophy and a long explanation.`, `What do you call ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} when the record is also ${c.value}? ${name(c.playerId)} has an answer, and nobody has asked.`, `${name(c.playerId)} hit ${c.value} ${RECORD_LABEL[c.key].toLowerCase()} and found out the record already said ${c.value}. Great minds, or just late.`))
  }
  for (const c of callouts.filter((x) => x.kind === "careerHigh")) {
    add(2.5, c.playerId, say(s.date + c.playerId + "ch", `New personal best for ${name(c.playerId)}: ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}. The old best of ${c.previous} was not impressive and neither was the wait.`, `${c.previous} ${RECORD_LABEL[c.key].toLowerCase()} was the best ${name(c.playerId)} had done, until tonight made it ${c.value}.`, `${name(c.playerId)} set a personal best in ${RECORD_LABEL[c.key].toLowerCase()}: ${c.value}. The old ${c.previous} did not see it coming and neither did anyone else.`, `${c.value} ${RECORD_LABEL[c.key].toLowerCase()} for ${name(c.playerId)}, up from ${c.previous}. Somebody will mention it at every game for a month.`, `${name(c.playerId)} topped their own best in ${RECORD_LABEL[c.key].toLowerCase()}, ${c.value} to ${c.previous}, and the only player beaten was themselves.`, `The ${c.previous} ${name(c.playerId)} had been carrying around in ${RECORD_LABEL[c.key].toLowerCase()} is retired. It is ${c.value} now.`, `${name(c.playerId)} had ${c.value} ${RECORD_LABEL[c.key].toLowerCase()}, the best of a career that previously topped out at ${c.previous}.`, `Remember when ${c.previous} ${RECORD_LABEL[c.key].toLowerCase()} was ${name(c.playerId)}'s best? It is ${c.value} now, so forget that.`))
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
      add(2 + (0.35 - u.chance) * 10, null, say(s.date + "upset", `Nobody gave ${winners.map(name).join(", ")} a chance, ${pct(u.chance)}%, and they won ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)} anyway. The favorites should be embarrassed.`, `The odds said ${pct(u.chance)}% and ${winners.map(name).join(", ")} did not care. ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)}, and a lot of people lost confidence in the model.`, `${winners.map(name).join(", ")} beat a team that was supposed to beat them, ${Math.max(g.scoreA, g.scoreB)}-${Math.min(g.scoreA, g.scoreB)}, from ${pct(u.chance)}% odds. The losing side now has to explain that.`))
    }
  }

  if (s.closest && Math.abs(s.closest.scoreA - s.closest.scoreB) <= 2) {
    add(1.5, null, say(s.date + "close", `${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. One bounce the other way and the loser would be the winner, and the winner would be insufferable anyway.`, `The closest game of the night came down to ${Math.abs(s.closest.scoreA - s.closest.scoreB)}, ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)}. Somebody is already telling a story about the one call that cost them.`, `Was that a foul? Was that out? It ended ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)} and the argument is still going.`, `A coin flip would have been less stressful than that ${Math.max(s.closest.scoreA, s.closest.scoreB)}-${Math.min(s.closest.scoreA, s.closest.scoreB)} finish.`))
  }
  if (s.biggestWin && Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) >= 10) {
    add(Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB) / 5, null, say(s.date + "win", `${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)} for ${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")}. At some point the other team was just standing there for company.`, `${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won ${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}. The other team's best moment was probably the water break.`, `${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)} for ${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")}, which makes any claim of a close second half a work of fiction.`, `${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won by ${Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB)}, ${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}. The other team spent most of it retrieving the ball.`, `${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)} for ${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")}. The other team scored ${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)} and called it a game.`, `${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won by ${Math.abs(s.biggestWin.scoreA - s.biggestWin.scoreB)}. Somebody on the other side is now saying the score does not reflect the game, and it does.`, `${(s.biggestWin.winner === "A" ? s.biggestWin.teamA : s.biggestWin.teamB).map(name).join(", ")} won ${Math.max(s.biggestWin.scoreA, s.biggestWin.scoreB)}-${Math.min(s.biggestWin.scoreA, s.biggestWin.scoreB)}, and the other team's plan to stay in it did not survive the first few minutes.`))
  }

  const hot = streaks(state, s.date).filter((x) => x.kind === "W" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (hot) add(hot.n * 0.6, hot.id, labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, s.date) ?? say(s.date + hot.id + "hot", `${name(hot.id)} has won ${hot.n} straight and nobody has found an answer. Somebody, please, anybody.`, `${hot.n} wins in a row for ${name(hot.id)}. At this point the other team is just scheduling the loss.`, `${name(hot.id)} is on a ${hot.n}-game win streak, and everyone who has lost to them is quietly pretending it was a fluke.`, `${name(hot.id)} has won ${hot.n} in a row, and rumor is the ball only goes to ${name(hot.id)} now.`, `${name(hot.id)} has won ${hot.n} in a row, and the water is starting to look nervous.`))
  const cold = streaks(state, s.date).filter((x) => x.kind === "L" && x.n >= 4).sort((x, y) => y.n - x.n)[0]
  if (cold) add(cold.n * 0.6, cold.id, labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, s.date) ?? say(s.date + cold.id + "cold", `${name(cold.id)} has lost ${cold.n} in a row, and at some point it stops being bad luck and starts being a personality.`, `${cold.n} straight losses for ${name(cold.id)}. Teams are now trying to give them away.`, `Is it ${name(cold.id)}, or is it the teams? ${cold.n} losses in a row is starting to answer that.`, `${name(cold.id)} has lost ${cold.n} straight and is being studied.`, `${cold.n} losses in a row for ${name(cold.id)}. A small plaque is being discussed.`, `${name(cold.id)} has lost ${cold.n} straight and is now officially treading water.`))

  extraNightStories(state, s, name, add, abn)
  // Most unusual first, and no player gets more than two headlines so one big night does not take over the list.
  const all = rank(items, 12)
  if (all.length === 0 && s.topScorer) all.push(`${name(s.topScorer.id)} led the night with ${s.topScorer.pts} points.`)
  return all
}

// ---- going into a night ---------------------------------------------------------------------------------
export function previewStories(state: PooleanState, name: Name): string[] {
  const items: Item[] = []
  const add = adder(items)
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
  if (bestWin && bestWin[1] >= 2) add(1.5 + bestWin[1] * 0.5, bestWin[0], say(lastDate + "last", `Last time out, ${name(bestWin[0])} won ${bestWin[1]} of ${plural(last.length, "game")} and has been unbearable since.`, `${name(bestWin[0])} took ${bestWin[1]} of ${plural(last.length, "game")} last time. The rematch starts tonight, and everybody else would like to humble them.`, `Who beats ${name(bestWin[0])} tonight? They won ${bestWin[1]} of ${plural(last.length, "game")} last time and everybody else is ready to find out.`))

  const run = streaks(state)
  const hot = run.filter((x) => x.kind === "W" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (hot) add(hot.n * 0.6, hot.id, labelLine(state, hot.id, "streakW", { n: name(hot.id), k: hot.n }, lastDate) ?? say(lastDate + hot.id + "hot", `${name(hot.id)} walks in on a ${hot.n}-game win streak, and every opponent already looks nervous.`, `Can anybody stop ${name(hot.id)}? They have won ${hot.n} straight, and the answer so far is no.`, `${hot.n} straight wins for ${name(hot.id)}, and the other team's best plan is to hope it rains.`, `${name(hot.id)} comes in on ${hot.n} wins in a row, and the rest of the group is quietly shopping for a new strategy.`))
  const cold = run.filter((x) => x.kind === "L" && x.n >= 3).sort((x, y) => y.n - x.n)[0]
  if (cold) add(cold.n * 0.6, cold.id, labelLine(state, cold.id, "streakL", { n: name(cold.id), k: cold.n }, lastDate) ?? say(lastDate + cold.id + "cold", `${cold.n} losses in a row for ${name(cold.id)}. Tonight is a good time for a win, and a bad time to be on their team.`, `${name(cold.id)} has lost ${cold.n} in a row and is looking for a win like a person looking for their keys.`, `${name(cold.id)} walks in with ${cold.n} straight losses, which is a lot to carry in one bag.`, `${cold.n} straight losses for ${name(cold.id)}. Tonight is either the turnaround or a tradition.`, `${name(cold.id)} is ${cold.n} losses into a bad stretch and still showing up, which is either brave or a clerical error.`))

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
  if (leader) add(2 + zAmong([...per.values()].filter((v) => v.tw.length >= 3).map((v) => avg(v.tw)), avg(leader[1].tw)), leader[0], say(lastDate + "lead", `${name(leader[0])} leads the league in two-way score at ${avg(leader[1].tw).toFixed(1)} a game, which has been mentioned already, by ${name(leader[0])}.`, `${avg(leader[1].tw).toFixed(1)} two-way a game puts ${name(leader[0])} on top and the rest of the group on notice.`, `Best all-around player so far: ${name(leader[0])}, ${avg(leader[1].tw).toFixed(1)} two-way a game, and a lot of people are checking the math.`, `Ask who leads in two-way score. ${name(leader[0])}, ${avg(leader[1].tw).toFixed(1)} a game, and they will say it first.`))
  const seasonWins = new Map<string, number>()
  rs.forEach((r) => r.winners.forEach((id) => seasonWins.set(id, (seasonWins.get(id) ?? 0) + 1)))
  const heating = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.recent - x.season >= 2)
    .sort((x, y) => y.recent - y.season - (x.recent - x.season))[0]
  if (heating) add(abn(heating.id, ptsPick, heating.recent), heating.id, say(lastDate + heating.id + "heat", `${name(heating.id)} has scored ${heating.recent.toFixed(1)} a game over the last 3, up from ${heating.season.toFixed(1)} on the year. Somebody should guard them tonight, for once.`, `${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} lately against ${heating.season.toFixed(1)} for the season, and the defense has not adjusted.`, `Whoever draws ${name(heating.id)} tonight should be nervous. ${heating.recent.toFixed(1)} a game recently, ${heating.season.toFixed(1)} on the year.`, `${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} a game lately, and the thermometer has been taken away for safety.`, `${name(heating.id)} is heating up: ${heating.recent.toFixed(1)} a game lately, and the pool has been asked to cool down.`))

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
    add(1 + Math.abs(rival.aw - rival.bw) * 0.4, top, say(lastDate + top + "rival", `${name(top)} is ${tw}-${bw} against ${name(bottom)}. ${name(bottom)} keeps asking for another game, which is not helping.`, `${name(bottom)} keeps playing ${name(top)} and keeps losing: ${bw}-${tw}. Some people never learn.`, `Think ${name(bottom)} can beat ${name(top)} tonight? The record is ${bw}-${tw} all time, and the history is not on ${name(bottom)}'s side.`))
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
  if (winless) add(1.5 + winless.gp * 0.3, winless.id, say(lastDate + winless.id + "wl", `${name(winless.id)} is still looking for a first win. Their teams are looking for a new teammate.`, `When does ${name(winless.id)} get that first win? Not yet, and the group is running out of patience.`, `${name(winless.id)} has not won a game yet, so the first one will come with paperwork.`, `Still no wins for ${name(winless.id)}, so the first one will be reported as breaking news.`))
  const coldHand = [...per.entries()]
    .filter(([, v]) => v.pts.length >= 6)
    .map(([id, v]) => ({ id, recent: avg(v.pts.slice(-3)), season: avg(v.pts) }))
    .filter((x) => x.season - x.recent >= 2)
    .sort((x, y) => y.season - y.recent - (x.season - x.recent))[0]
  if (coldHand) add(abn(coldHand.id, ptsPick, coldHand.recent), coldHand.id, say(lastDate + coldHand.id + "ch", `${name(coldHand.id)} has scored ${coldHand.recent.toFixed(1)} a game lately, down from ${coldHand.season.toFixed(1)}, and is probably blaming the ball.`, `${name(coldHand.id)} is averaging ${coldHand.recent.toFixed(1)} over the last 3, down from ${coldHand.season.toFixed(1)}, which is the kind of drop people ask a doctor about.`, `${coldHand.recent.toFixed(1)} a game lately for ${name(coldHand.id)}, after ${coldHand.season.toFixed(1)} all season. Somebody is checking the car for the rest.`, `${name(coldHand.id)} dropped from ${coldHand.season.toFixed(1)} to ${coldHand.recent.toFixed(1)} a game, and the missing points are believed to be in the lost and found.`, `Last 3 games: ${coldHand.recent.toFixed(1)} a game for ${name(coldHand.id)}. Season average: ${coldHand.season.toFixed(1)}. The difference has been reported missing.`))
  const lastTw = [...per.entries()].filter(([, v]) => v.tw.length >= 3).sort((x, y) => avg(x[1].tw) - avg(y[1].tw))[0]
  if (lastTw && avg(lastTw[1].tw) < 0 && lastTw[0] !== leader?.[0]) add(1.5 + zAmong([...per.values()].filter((v) => v.tw.length >= 3).map((v) => avg(v.tw)), avg(lastTw[1].tw)), lastTw[0], say(lastDate + "rear", `${name(lastTw[0])} is last in two-way score at ${avg(lastTw[1].tw).toFixed(1)} a game. That is the whole league, and they are at the bottom of it.`, `Their team is usually better off when ${name(lastTw[0])} is not on it: ${avg(lastTw[1].tw).toFixed(1)} two-way a game.`, `${avg(lastTw[1].tw).toFixed(1)} two-way a game puts ${name(lastTw[0])} at the bottom of the league, which is the only place with enough room.`, `${name(lastTw[0])} is at ${avg(lastTw[1].tw).toFixed(1)} two-way a game. That is last, and it is not close.`))
  return rank(items, 8)
}

// ---- the season so far ----------------------------------------------------------------------------------
export function seasonStories(state: PooleanState, name: Name): string[] {
  const since = state.currentSeasonStartedAt || ""
  const rs = results(state).filter((r) => !since || r.date >= since)
  const items: Item[] = []
  const add = adder(items)
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
  if (ranked[0]) add(4, ranked[0][0], say("pace" + ranked[0][0], `${ranked[0][1].w}-${ranked[0][1].l} for ${name(ranked[0][0])}, and nobody has caught up. Take your time, everyone.`, `${name(ranked[0][0])} is ${ranked[0][1].w}-${ranked[0][1].l} and in front, and the chasing pack has started calling it cardio.`))
  if (ranked[1] && winPct(ranked[0][1]) - winPct(ranked[1][1]) <= 0.05) add(2.2, ranked[0][0], `${name(ranked[0][0])} and ${name(ranked[1][0])} are neck and neck for the top spot. Whoever loses next will hear about it.`)

  const scorer = [...all].sort((x, y) => y[1].pts - x[1].pts)[0]
  if (scorer && scorer[1].pts > 0) add(2 + zAmong(all.map(([, v]) => v.pts), scorer[1].pts), scorer[0], say("scorer" + scorer[0], `${name(scorer[0])} is the top scorer with ${scorer[1].pts} points, ${(scorer[1].pts / scorer[1].gp).toFixed(1)} a game, and took every shot to get there.`, `${scorer[1].pts} points for ${name(scorer[0])}, the league's top scorer. Whether that is skill or volume is still being debated.`, `Who scores the most? ${name(scorer[0])}, ${scorer[1].pts} points, and a lot of shots to go with them.`))
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
  if (b && b.n >= 4) add(b.n * 0.6, b.id, say("streak" + b.id, `${name(b.id)}'s ${b.n}-game win streak is the longest of the season. Somebody should have stopped them sooner.`, `The longest win streak of the season belongs to ${name(b.id)}: ${b.n}. Everybody else will have to live with that.`, `${name(b.id)} won ${b.n} in a row, the longest streak of the season, and the other side keeps asking for a recount.`, `${b.n} straight wins for ${name(b.id)}, a streak that has now outlasted most summer plans.`))

  const iron = [...all].sort((x, y) => y[1].gp - x[1].gp)[0]
  if (iron && iron[1].gp >= 5) add(1, iron[0], say("iron" + iron[0], `${name(iron[0])} has played in ${iron[1].gp} of ${rs.length} games, more than anyone. Either dedicated, or has nothing else going on.`, `Attendance leader: ${name(iron[0])}, ${iron[1].gp} of ${rs.length}, and the pool probably knows them by name.`, `${name(iron[0])} has played ${iron[1].gp} of ${rs.length} games, which is the kind of attendance usually reserved for furniture.`))

  // Bad news for the season.
  const last = ranked[ranked.length - 1]
  if (last && ranked.length >= 3) add(2, last[0], say("last" + last[0], `${last[1].w}-${last[1].l} for ${name(last[0])}, the lowest win rate in the league. Pick them last until they prove otherwise.`, `Somebody has to be last, and so far it is ${name(last[0])} at ${last[1].w}-${last[1].l}, with room to improve.`, `${name(last[0])} is last at ${last[1].w}-${last[1].l}, and a plaque has been ordered.`, `${name(last[0])} sits at the bottom of the standings, ${last[1].w}-${last[1].l}, and has been asked to hold the spot until further notice.`, `${last[1].w}-${last[1].l}, ${name(last[0])}, last place. The bottom of the table has been reinforced for the weight.`, `${name(last[0])} is last at ${last[1].w}-${last[1].l}, and the deep end has offered them a room.`))
  const toughest = rs.reduce((m, r) => (Math.abs(r.a - r.b) > Math.abs(m.a - m.b) ? r : m), rs[0])
  if (Math.abs(toughest.a - toughest.b) >= 10) add(Math.abs(toughest.a - toughest.b) / 5, null, say("blowout" + toughest.a, `The biggest blowout of the season was ${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, with ${toughest.losers.map(name).join(", ")} on the losing end. They have not brought it up since.`, `${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, ${toughest.losers.map(name).join(", ")} on the wrong end. The replay was requested by exactly zero people and viewed by exactly zero.`, `${toughest.losers.map(name).join(", ")} lost ${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, the worst loss of the season, and everyone remembers exactly where they were standing.`, `${Math.max(toughest.a, toughest.b)}-${Math.min(toughest.a, toughest.b)}, ${toughest.losers.map(name).join(", ")} on the losing side, and the final score has become a cautionary tale.`))
  const turn = [...rec.keys()]
    .map((id) => {
      const lines = rs.filter((r) => [...r.game.teamA, ...r.game.teamB].includes(id)).map((r) => playerLine(r.game, id)).filter((l) => l.box)
      return { id, n: lines.length, tov: lines.reduce((a, l) => a + l.tov, 0) }
    })
    .filter((x) => x.n >= 3)
    .sort((x, y) => y.tov / y.n - x.tov / x.n)[0]
  if (turn && turn.tov / turn.n >= 1.5) add(1.5, turn.id, say("tov" + turn.id, `${name(turn.id)} leads the league in turnovers at ${(turn.tov / turn.n).toFixed(1)} a game, and the other teams appreciate it.`, `${(turn.tov / turn.n).toFixed(1)} turnovers a game makes ${name(turn.id)} the league leader in giveaways. Generous to a fault.`, `Who gives the ball away most? ${name(turn.id)}, ${(turn.tov / turn.n).toFixed(1)} a game, and counting.`, `${name(turn.id)} gives the ball away ${(turn.tov / turn.n).toFixed(1)} times a game, and charity auditors are watching.`, `${name(turn.id)} gives the ball away ${(turn.tov / turn.n).toFixed(1)} times a game, and the pool is now full of them.`))
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
  if (hot && hot.fgm / hot.fga >= 0.6) add(abn(hot.id, fgPick, hot.fgm / hot.fga), hot.id, labelLine(state, hot.id, "hot", { n: name(hot.id), fg: fg(hot.fgm, hot.fga) }, s.date) ?? say(s.date + hot.id + "fg", `Every shot ${name(hot.id)} took went in, more or less: ${fg(hot.fgm, hot.fga)}. Somebody was supposed to be guarding.`, `${name(hot.id)} shot ${fg(hot.fgm, hot.fga)}${usualFg(hot.id)}, and the defense has asked to see the shot chart for evidence of a conspiracy.`, `${fg(hot.fgm, hot.fga)} for ${name(hot.id)}. Somebody check the ball for a hidden motor.`, `${name(hot.id)} went ${fg(hot.fgm, hot.fga)} from the field and has been asked to share whatever it is.`, `The rim stopped fighting ${name(hot.id)} tonight. ${fg(hot.fgm, hot.fga)}.`, `${name(hot.id)} hit ${fg(hot.fgm, hot.fga)}, a pace usually reserved for video games with the cheat codes on.`, `${fg(hot.fgm, hot.fga)} for ${name(hot.id)}. Several people are checking whether the rim has been made wider.`, `${name(hot.id)} shot ${fg(hot.fgm, hot.fga)}${usualFg(hot.id)}, so the defense is going to need a bigger plan and a smaller ego.`, `Nobody is sure what ${name(hot.id)} ate, but ${fg(hot.fgm, hot.fga)} is the result and everyone wants some.`, `${fg(hot.fgm, hot.fga)} for ${name(hot.id)}. The hoop looked like a kiddie pool from up there.`, `${name(hot.id)} shot ${fg(hot.fgm, hot.fga)}, and several people have asked whether the water was on their side.`))
  const cold = [...shooters].sort((x, y) => x.fgm / x.fga - y.fgm / y.fga)[0]
  if (cold && cold.fgm / cold.fga <= 0.3 && cold.id !== hot?.id) add(abn(cold.id, fgPick, cold.fgm / cold.fga), cold.id, labelLine(state, cold.id, "cold", { n: name(cold.id), fg: fg(cold.fgm, cold.fga) }, s.date) ?? say(s.date + cold.id + "fg", `${name(cold.id)} shot ${fg(cold.fgm, cold.fga)}${usualFg(cold.id)} and kept shooting. That is not confidence, that is a lack of information.`, `Somebody take the ball from ${name(cold.id)}. ${fg(cold.fgm, cold.fga)}, and every miss was a decision.`, `Was ${name(cold.id)} even looking at the rim? ${fg(cold.fgm, cold.fga)}.`, `${fg(cold.fgm, cold.fga)} for ${name(cold.id)}, and the other team spent the whole game hoping they would keep going.`, `${name(cold.id)} went ${fg(cold.fgm, cold.fga)}. A blindfolded raccoon standing in the same spot would have made at least one more.`, `${name(cold.id)} shot ${fg(cold.fgm, cold.fga)}, which in some countries counts as a different sport.`, `${fg(cold.fgm, cold.fga)} for ${name(cold.id)}, which counts as drowning in most pools.`, `${name(cold.id)} went ${fg(cold.fgm, cold.fga)} and blamed the chlorine, the sun, and a very loud flamingo.`))

  // Rough nights.
  const worst = [...boxed].sort((x, y) => x.twoWay - y.twoWay)[0]
  if (worst && worst.twoWay < 0 && worst.id !== s.mvp?.id) add(abn(worst.id, twPick, worst.twoWay / worst.boxGames), worst.id, say(s.date + worst.id + "tw", `${name(worst.id)} finished at ${worst.twoWay.toFixed(1)} two-way, which means the team did better when they sat. They should consider sitting.`, `Quick question for ${name(worst.id)}: how do you finish at ${worst.twoWay.toFixed(1)} two-way, and are you proud?`, `${worst.twoWay.toFixed(1)} two-way for ${name(worst.id)}. At that number, sitting would have been a team move.`, `${name(worst.id)} was at ${worst.twoWay.toFixed(1)} two-way and played better for the other team than for their own.`, `${name(worst.id)} finished at ${worst.twoWay.toFixed(1)} two-way. The other team has asked if ${name(worst.id)} is available next game.`, `${name(worst.id)} finished at ${worst.twoWay.toFixed(1)} two-way, which is the stat version of a pool noodle.`))
  const sloppy = [...boxed].sort((x, y) => y.tov - x.tov)[0]
  if (sloppy && sloppy.tov >= 4) add(abn(sloppy.id, tovPick, sloppy.tov / sloppy.boxGames), sloppy.id, labelLine(state, sloppy.id, "tov", { n: name(sloppy.id), k: sloppy.tov }, s.date) ?? say(s.date + sloppy.id + "tov", `${sloppy.tov} turnovers for ${name(sloppy.id)}. Passing to the wrong team counts as passing, technically, and it counted ${sloppy.tov} times.`, `${name(sloppy.id)} had ${sloppy.tov} turnovers. At that rate the other team should list them in the box score as an assist.`, `${name(sloppy.id)} turned it over ${sloppy.tov} times, so the other team basically had them on the roster.`, `${sloppy.tov} turnovers for ${name(sloppy.id)}, each one somewhere between a pass and a donation.`, `How many times did ${name(sloppy.id)} give it away? ${sloppy.tov}. Did anyone ask them to stop? Yes, repeatedly.`, `${name(sloppy.id)} had ${sloppy.tov} turnovers. The other team has offered a contract.`, `${name(sloppy.id)} had ${sloppy.tov} turnovers, and the ball has started floating away on purpose.`, `${sloppy.tov} turnovers for ${name(sloppy.id)}, and a few of them were just the ball floating off.`))
  const fouls = [...boxed].sort((x, y) => y.pf - x.pf)[0]
  if (fouls && fouls.pf >= 4) add(abn(fouls.id, pfPick, fouls.pf / fouls.boxGames), fouls.id, labelLine(state, fouls.id, "foul", { n: name(fouls.id), k: fouls.pf }, s.date) ?? say(s.date + fouls.id + "pf", `${name(fouls.id)} was whistled ${fouls.pf} times, the most of the night. Defense does not require this much contact.`, `You can play defense without touching people, ${name(fouls.id)}. ${fouls.pf} fouls says you have not tried.`, `Nobody is officiating, so the group counted for ${name(fouls.id)}: ${fouls.pf} fouls and a lot of arguing about it.`, `${fouls.pf} fouls for ${name(fouls.id)}, which is more contact than a rugby scrum.`, `${name(fouls.id)} had ${fouls.pf} fouls, which is more splashing than any rule allows.`))

  // Scoring droughts.
  const scoreless = s.players.filter((p) => p.games >= 2 && p.pts === 0)
  scoreless.forEach((p) => add(abn(p.id, ptsPick, 0), p.id, labelLine(state, p.id, "zero", { n: name(p.id), g: p.games }, s.date) ?? say(s.date + p.id + "zero", `${name(p.id)} did not score in ${plural(p.games, "game")}. That takes some effort, and nobody noticed any.`, `Nobody can remember ${name(p.id)} scoring tonight, and the box score confirms it: zero in ${plural(p.games, "game")}.`, `${name(p.id)} played ${plural(p.games, "game")} and never got on the board, which means their teams played short.`, `Zero points for ${name(p.id)} across ${plural(p.games, "game")}. At least they were consistent.`, `${name(p.id)} scored zero in ${plural(p.games, "game")} and is now being used as a unit of measurement.`, `${name(p.id)} scored zero in ${plural(p.games, "game")} and is being compared to a noodle.`)))
  const quiet = [...s.players].filter((p) => p.games >= 3 && p.pts > 0).sort((x, y) => x.pts / x.games - y.pts / y.games)[0]
  if (quiet && quiet.pts / quiet.games <= 3) add(abn(quiet.id, ptsPick, quiet.pts / quiet.games), quiet.id, say(s.date + quiet.id + "q", `Was ${name(quiet.id)} even there? ${quiet.pts} points in ${plural(quiet.games, "game")} makes it hard to tell.`, `${name(quiet.id)} had ${quiet.pts} points in ${plural(quiet.games, "game")}, which is what happens when you play like a spectator.`, `${name(quiet.id)} had ${quiet.pts} points in ${plural(quiet.games, "game")}, which is an active way of not being involved.`, `${quiet.pts} points in ${plural(quiet.games, "game")} for ${name(quiet.id)}, and the ball found them about as often as the mail does on a holiday.`, `${name(quiet.id)} scored ${quiet.pts} in ${plural(quiet.games, "game")}. The box score is the only proof they came.`, `${name(quiet.id)}'s night in full: ${quiet.pts} points, ${plural(quiet.games, "game")}, and a lot of standing around.`, `${quiet.pts} points in ${plural(quiet.games, "game")} for ${name(quiet.id)}, a total usually posted by a tree.`, `${quiet.pts} points in ${plural(quiet.games, "game")} for ${name(quiet.id)}, who was mostly just floating.`))

  // Defense and hustle.
  const swat = [...boxed].sort((x, y) => y.blk - x.blk)[0]
  if (swat && swat.blk >= 3) add(abn(swat.id, blkPick, swat.blk / swat.boxGames), swat.id, say(s.date + swat.id + "blk", `${name(swat.id)} sent back ${swat.blk} shots tonight, and every shooter who got blocked is still thinking about it.`, `Nobody got an easy look at the rim with ${name(swat.id)} around: ${swat.blk} blocks.`, `${swat.blk} blocks for ${name(swat.id)}. A few of you should probably stop driving on them.`, `${name(swat.id)} blocked ${swat.blk} shots, one of which has not landed yet.`, `${name(swat.id)} swatted ${swat.blk} shots, and a few are still floating in the water.`))
  const thief = [...boxed].sort((x, y) => y.stl - x.stl)[0]
  if (thief && thief.stl >= 4) add(abn(thief.id, stlPick, thief.stl / thief.boxGames), thief.id, say(s.date + thief.id + "stl", `Did anyone tell the ball handlers about ${name(thief.id)}? ${thief.stl} steals says no.`, `${name(thief.id)} stole it ${thief.stl} times and probably asked for credit each time.`, `${name(thief.id)} took it ${thief.stl} times. At some point it stops being a steal and starts being a trade.`, `${thief.stl} steals for ${name(thief.id)}, who treated other people's dribbling as a free sample.`, `${thief.stl} steals for ${name(thief.id)}, and somebody is already practicing a crossover in the mirror. It will not help.`, `${name(thief.id)} had ${thief.stl} steals, and a few ball handlers are still looking for what went missing.`, `${thief.stl} steals tonight, ${name(thief.id)}. The ball handlers keep acting like it is a new thing.`, `${name(thief.id)} swiped it ${thief.stl} times. A couple of those were gifts, and the rest were just rude.`, `${thief.stl} steals for ${name(thief.id)}, and not one of them looked difficult.`, `${name(thief.id)} stole it ${thief.stl} times, which suggests a few people were holding the ball like it was a sandwich.`, `${thief.stl} steals for ${name(thief.id)}, who is now being investigated by three separate ball handlers.`, `${name(thief.id)} stole it ${thief.stl} times and is rumored to be wanted in two counties.`, `${name(thief.id)} had ${thief.stl} steals and has been asked to stop taking the pool noodles too.`, `${thief.stl} steals for ${name(thief.id)}, who treats every floating thing as free.`))
  // A double-double is one game, not a night's total: 10 points and 10 rebounds in the same game.
  const gameLines = state.games
    .filter((g) => g.date === s.date && !g.liveInProgress)
    .flatMap((g) => [...g.teamA, ...g.teamB].map((id) => ({ id, l: playerLine(g, id) })))
    .filter((x) => x.l.box)
  const ddHit = gameLines.find((x) => x.l.pts >= 10 && x.l.reb >= 10)
  const dd = ddHit && { id: ddHit.id, pts: ddHit.l.pts, reb: ddHit.l.reb }
  if (dd) add(2.5, dd.id, say(s.date + dd.id + "dd", `Did ${name(dd.id)} need both stats at once? ${dd.pts} points and ${dd.reb} rebounds, a double-double.`, `${dd.pts} and ${dd.reb} for ${name(dd.id)}. The double-double is real and the humility is not.`, `${name(dd.id)} had ${dd.pts} points and ${dd.reb} rebounds, which is a double-double and an excuse to talk for a week.`, `${dd.pts} and ${dd.reb} for ${name(dd.id)}. Two stats finished in double digits and nobody else's finished anything.`, `${name(dd.id)} went for ${dd.pts} and ${dd.reb}, then walked to the cooler like it was Tuesday.`, `${dd.pts} points, ${dd.reb} rebounds, and a calm face from ${name(dd.id)}. That calm is the annoying part.`, `Who gave ${name(dd.id)} permission to score ${dd.pts} and grab ${dd.reb}? Nobody, and it happened anyway.`, `${name(dd.id)} grabbed ${dd.reb} rebounds and scored ${dd.pts}, which is a lot of stuff for one person to touch.`, `${name(dd.id)} posted ${dd.pts} points and ${dd.reb} rebounds. Everyone else posted something less.`, `${dd.pts} and ${dd.reb} for ${name(dd.id)}. The rest of the group can check their own numbers privately.`, `${dd.pts} and ${dd.reb} for ${name(dd.id)}, who is now being scouted by a team that does not exist.`, `${dd.pts} and ${dd.reb} for ${name(dd.id)}, who is now being recruited by a swim team.`))
  const dimeHit = gameLines.find((x) => x.l.pts >= 10 && x.l.ast >= 10)
  const dime = dimeHit && { id: dimeHit.id, pts: dimeHit.l.pts, ast: dimeHit.l.ast }
  if (dime && dime.id !== dd?.id) add(2.5, dime.id, say(s.date + dime.id + "dm", `${name(dime.id)} scored ${dime.pts} and passed for ${dime.ast}, so the whole team ate and ${name(dime.id)} still got the credit.`, `${dime.pts} points and ${dime.ast} assists: ${name(dime.id)} was in every basket and wants everyone to know.`))

  // Bounce-backs and slumps, measured from before the night.
  const before = new Map(streaks(state, prevDate(state, s.date)).map((x) => [x.id, x]))
  for (const p of s.players) {
    const b = before.get(p.id)
    if (b && b.kind === "L" && b.n >= 3 && p.wins > 0) add(b.n * 0.6, p.id, say(s.date + p.id + "snap", `${name(p.id)} broke a ${b.n}-game losing streak, which is the only good news the group had all week.`, `${b.n} straight losses for ${name(p.id)}, then a win with no ceremony. Somebody bring a cake next time.`, `${name(p.id)} finally won again after ${b.n} losses. Time to find out whether that was luck.`, `${name(p.id)} won after ${b.n} straight losses. Check the scoreboard again, because that is not a normal sentence.`, `A win for ${name(p.id)}, finally, after ${b.n} losses. Whoever was on the other side is now the story.`, `${name(p.id)} lost ${b.n} straight and then won, which means the streak ended and the excuses can finally be retired.`, `${name(p.id)} is not on a losing streak anymore. That has been true for exactly one game.`, `The ${b.n}-game losing streak for ${name(p.id)} is over, and the group is already guessing how long the win lasts.`, `${name(p.id)} ended a ${b.n}-game losing streak tonight. Somebody check the other team for a reason.`, `${name(p.id)} won after ${b.n} straight losses, and the news is being read out on local radio.`, `${name(p.id)} won after ${b.n} losses, and a pool noodle cheered, which is rare.`))
    if (b && b.kind === "W" && b.n >= 3 && p.wins === 0 && p.losses > 0) add(b.n * 0.6, p.id, say(s.date + p.id + "over", `${name(p.id)} lost for the first time in ${b.n} games, and everyone else celebrated like it was a holiday.`, `The ${b.n}-game win streak ends tonight, and ${name(p.id)} gets to hear about it from everyone.`, `Streak over: ${name(p.id)} was beaten after ${b.n} straight wins. It was fun while it lasted for everyone but them.`))
  }

  // The blown-out side, named.
  const rout = s.biggestWin
  if (rout && Math.abs(rout.scoreA - rout.scoreB) >= 10) {
    const losers = rout.winner === "A" ? rout.teamB : rout.teamA
    add(Math.abs(rout.scoreA - rout.scoreB) / 5, null, say(s.date + "rout", `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}. If the other team had stopped, it would have been out of pity.`, `Never in it: ${losers.map(name).join(", ")}, ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}.`, `${losers.map(name).join(", ")} scored ${Math.min(rout.scoreA, rout.scoreB)} and gave up ${Math.max(rout.scoreA, rout.scoreB)}. That is two problems.`, `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)} and will say it was closer than it looked. It was not.`, `After ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}, ${losers.map(name).join(", ")} want a rematch. Please enjoy the optimism.`, `${losers.map(name).join(", ")} scored ${Math.min(rout.scoreA, rout.scoreB)} and are rumored to have done it on purpose.`, `${losers.map(name).join(", ")} lost ${Math.min(rout.scoreA, rout.scoreB)}-${Math.max(rout.scoreA, rout.scoreB)}, and somebody blew an imaginary whistle for them, kindly.`))
  }
  const cool = [...streaks(state, s.date)].filter((x) => x.kind === "L" && x.n === 3)
  cool.slice(0, 2).forEach((x) => add(1.2, x.id, say(s.date + x.id + "three", `3 straight losses for ${name(x.id)}. Is everything okay at home?`, `${name(x.id)} is on a 3-game losing streak, and 3 is the number where it stops being a coincidence.`, `Three in a row for ${name(x.id)}, and not the good kind.`, `${name(x.id)} has lost 3 straight and is currently the safest pick for the other team.`, `${name(x.id)} dropped a third straight game tonight. At this point it is a habit with a schedule.`, `${name(x.id)} has lost 3 in a row, and the number is being engraved on something.`, `${name(x.id)} has lost 3 in a row, and the pool has started to feel responsible.`)))

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
    regulars.slice(0, 2).forEach(([id]) => add(1.5, id, labelLine(state, id, "noshow", { n: name(id) }, s.date) ?? say(s.date + id + "ns", `${name(id)} was not at the game, which is unlike them. Somebody should text them, or at least pretend to care.`, `Every regular was there except ${name(id)}. Bold move, and the group has noticed.`, `Where was ${name(id)} tonight? Not here, and the group chat has already started guessing.`, `${name(id)} was not at the game, and a small search party is being assembled.`, `${name(id)} was not there, and the pool noodles have been asking about them.`)))
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
  if (up) add(abn(up.p.id, ptsPick, up.now), up.p.id, labelLine(state, up.p.id, "up", { n: name(up.p.id), pts: up.now.toFixed(1), avg: up.avg.toFixed(1) }, s.date) ?? say(s.date + up.p.id + "up", `${name(up.p.id)} averages ${up.avg.toFixed(1)} and scored ${up.now.toFixed(1)} a game tonight. Where was that all season?`, `Where did that come from, ${name(up.p.id)}? ${up.now.toFixed(1)} a game against a usual ${up.avg.toFixed(1)}, and now everyone wants to know why it is not always like this.`, `${name(up.p.id)} was a different player tonight, ${up.now.toFixed(1)} a game compared to the usual ${up.avg.toFixed(1)}. The old one can come back, honestly.`))
  const down = swings.filter((x) => x.now <= x.avg * 0.5 && x.avg - x.now >= 3).sort((x, y) => y.avg - y.now - (x.avg - x.now))[0]
  if (down) add(abn(down.p.id, ptsPick, down.now), down.p.id, labelLine(state, down.p.id, "down", { n: name(down.p.id), pts: down.now.toFixed(1), avg: down.avg.toFixed(1) }, s.date) ?? say(s.date + down.p.id + "down", `${name(down.p.id)} scored ${down.now.toFixed(1)} a game tonight, well under their usual ${down.avg.toFixed(1)}. Somebody check on them, or at least on the rim.`, `Is ${name(down.p.id)} feeling alright? ${down.now.toFixed(1)} a game against a usual ${down.avg.toFixed(1)} is not a good sign.`, `Not ${name(down.p.id)}'s night: ${down.now.toFixed(1)} a game when ${down.avg.toFixed(1)} is normal. They should probably leave that out of any speeches.`))

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
          add(2 + (bw - aw) * 0.3, w, labelLine(state, w, "revenge", { n: name(w), o: name(l), r: `${aw + 1}-${bw}` }, s.date) ?? say(s.date + w + l + "rev", `${name(w)} finally got one back on ${name(l)}, ${aw + 1}-${bw} all time. It only took forever.`, `${name(l)} lost to ${name(w)} tonight, which does not happen much: ${bw} to ${aw + 1} all time. ${name(w)} will not shut up about it.`))
        } else if (!ownedAgain && aw - bw >= 2) {
          ownedAgain = true
          add(2 + (aw - bw) * 0.3, l, labelLine(state, l, "owned", { n: name(l), o: name(w), r: `${bw}-${aw + 1}` }, s.date) ?? say(s.date + w + l + "own", `${name(l)} lost to ${name(w)} again, ${bw}-${aw + 1} all time. At this point ${name(l)} should just hand over the ball.`, `Every time ${name(w)} plays ${name(l)}, the same thing happens. ${aw + 1}-${bw}.`, `${name(w)} has ${name(l)} figured out: ${aw + 1}-${bw} all time, and it is not close.`))
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
    if (tonightAvg > Math.max(...others)) add(2, null, say(s.date + "high", `${tonightAvg.toFixed(1)} points a game tonight, the highest of any night, so apparently nobody was playing defense.`, `Highest-scoring night yet: ${tonightAvg.toFixed(1)} a game. Defense was a rumor.`, `Defense took the night off: ${tonightAvg.toFixed(1)} points a game, a new high, and everyone is acting like that was the plan.`, `${tonightAvg.toFixed(1)} points a game tonight, which in a real sport would be called a clerical error.`, `${tonightAvg.toFixed(1)} points a game tonight, which is a lot for a sport played mostly in water.`))
    else if (tonightAvg < Math.min(...others)) add(2, null, say(s.date + "low", `Lowest-scoring night yet, ${tonightAvg.toFixed(1)} a game. Nobody could hit anything and everybody had an excuse.`, `${tonightAvg.toFixed(1)} points a game. That was a cold night for everyone, and nobody has an excuse that works.`, `Fewest points of any night so far: ${tonightAvg.toFixed(1)} a game. Everybody check your shooting form.`, `${tonightAvg.toFixed(1)} points a game. Somebody should check the rim for a lid.`, `${tonightAvg.toFixed(1)} points a game. Everyone was waterlogged.`))
  }
}

// The night before a date, for streaks as they stood going in.
function prevDate(state: PooleanState, date: string): string {
  const days = [...new Set(state.games.filter((g) => g.date && g.date < date).map((g) => g.date))].sort()
  return days[days.length - 1] ?? ""
}
