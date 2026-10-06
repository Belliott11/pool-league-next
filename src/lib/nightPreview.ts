import { generateBalancedTeamSets } from "@/lib/balance"
import { headToHead } from "@/lib/headToHead"
import { injuryBoard, statusInfo } from "@/lib/injuries"
import { predictRealMatchup } from "@/lib/matchup"
import { gameDays, playerLine } from "@/lib/nightRecap"
import { rank, say, streaks, type Item } from "@/lib/storylines"
import type { PooleanState, Rsvp } from "@/lib/types"

type Name = (id: string) => string

const localToday = () => new Date().toLocaleDateString("en-CA")

// The next night people have signed up for: the earliest RSVP that is today or later.
export function upcomingRsvp(state: PooleanState, today = localToday()): Rsvp | null {
  return [...(state.rsvps ?? [])].filter((r) => r.date >= today && r.playerIds.length > 0).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
}

// Stories about this particular group: who is missing, who is hurt but coming, who is on a streak, who has a
// history with whom. Ranked so the most interesting are first, never more than two about the same player.
export function previewStoriesFor(state: PooleanState, coming: string[], name: Name): string[] {
  const here = new Set(coming)
  const items: Item[] = []
  const add = (w: number, pid: string | null, text: string) => items.push({ w, pid, text })
  const nights = gameDays(state)
  const attended = new Map<string, number>()
  for (const g of state.games) {
    if (g.liveInProgress || !g.date) continue
    for (const id of [...g.teamA, ...g.teamB]) attended.set(id, (attended.get(id) ?? 0) + 1)
  }
  const games = state.games.filter((g) => !g.liveInProgress && g.date)
  const played = (id: string) => new Set(games.filter((g) => g.teamA.includes(id) || g.teamB.includes(id)).map((g) => g.date))

  // Regulars who are not on the list.
  if (nights.length >= 4) {
    for (const p of state.players) {
      if (here.has(p.id)) continue
      const pct = Math.round((played(p.id).size / nights.length) * 100)
      if (pct >= 60) add(1 + pct / 100, p.id, say("pv-away" + p.id, `${name(p.id)} is a regular and is not on the list. Somebody should ask what is going on.`, `Where is ${name(p.id)}? Not on the list, and they have been to ${pct}% of the nights.`, `${name(p.id)} skipped the RSVP. The ${pct}% attendance record is taking a hit.`))
    }
  }

  // Coming while hurt.
  for (const inj of injuryBoard(state)) {
    if (!here.has(inj.playerId) || inj.status === "returning") continue
    const s = statusInfo(inj.status).label.toLowerCase()
    add(2.2, inj.playerId, say("pv-hurt" + inj.playerId, `${name(inj.playerId)} says they are coming and the injury report says ${s}. One of those is wrong.`, `${name(inj.playerId)} is on the list and on the injury report (${s}). Expect a lot of standing in the shade.`, `Is ${name(inj.playerId)} actually playing? The list says yes, the injury report says ${s}, and the group says wait and see.`))
  }

  // Back after time away.
  for (const id of coming) {
    const dates = played(id)
    if (dates.size === 0) continue
    const k = nights.findIndex((d) => dates.has(d))
    if (k >= 3) add(1.5 + k * 0.3, id, say("pv-back" + id, `${name(id)} is back after ${k} nights away. Rust is expected, and so are the stories.`, `${name(id)} has not played in ${k} nights and signed up anyway. Brave, or optimistic.`, `First night in ${k} for ${name(id)}. Somebody tell them what changed.`))
  }

  // Streaks.
  for (const s of streaks(state)) {
    if (!here.has(s.id) || s.n < 3) continue
    if (s.kind === "W") add(s.n * 0.6, s.id, say("pv-hot" + s.id, `${name(s.id)} is coming on a ${s.n}-game win streak. Somebody has to end it, and it will take more than hoping.`, `${s.n} wins in a row for ${name(s.id)}, and they signed up. That is confidence.`, `Can anybody on the list stop ${name(s.id)}? ${s.n} straight wins say probably not.`))
    else add(s.n * 0.6, s.id, say("pv-cold" + s.id, `${name(s.id)} has lost ${s.n} in a row and signed up anyway, which is brave or forgetful.`, `${s.n} losses in a row for ${name(s.id)}, and a spot on the list. Somebody is picking them anyway.`, `A win would help ${name(s.id)} tonight. ${s.n} straight losses is a lot of homework.`))
  }

  // Pairs on the list with a history.
  let best: { a: string; b: string; aw: number; bw: number } | null = null
  for (let i = 0; i < coming.length; i++) {
    for (let j = i + 1; j < coming.length; j++) {
      const h = headToHead(state, coming[i], coming[j])
      if (h.aWins + h.bWins < 4 || Math.abs(h.aWins - h.bWins) < 3) continue
      if (!best || Math.abs(h.aWins - h.bWins) > Math.abs(best.aw - best.bw)) best = { a: coming[i], b: coming[j], aw: h.aWins, bw: h.bWins }
    }
  }
  if (best) {
    const [top, bottom, tw, bw] = best.aw > best.bw ? [best.a, best.b, best.aw, best.bw] : [best.b, best.a, best.bw, best.aw]
    add(1 + (tw - bw) * 0.4, top, say("pv-pair" + top + bottom, `${name(top)} and ${name(bottom)} are both coming. ${name(top)} leads ${tw}-${bw}, and ${name(bottom)} still thinks that is temporary.`, `${name(bottom)} is ${bw}-${tw} against ${name(top)} and signed up for the same night. That is commitment.`, `Matchup to watch: ${name(top)} versus ${name(bottom)}, ${tw}-${bw}. Only one of them wants it.`))
  }

  // Best and worst all-around among the group.
  const tw = coming
    .map((id) => {
      const xs = games.map((g) => playerLine(g, id)).filter((l) => l.twoWay !== null).map((l) => l.twoWay as number)
      return { id, n: xs.length, avg: xs.reduce((a, b) => a + b, 0) / (xs.length || 1) }
    })
    .filter((x) => x.n >= 3)
    .sort((x, y) => y.avg - x.avg)
  if (tw.length >= 3) {
    const top = tw[0]
    const low = tw[tw.length - 1]
    add(2, top.id, say("pv-top" + top.id, `${name(top.id)} is the best all-around player on the list, ${top.avg.toFixed(1)} two-way a game. Everyone else is playing for second.`, `Who is the best on tonight's list? ${name(top.id)}, ${top.avg.toFixed(1)} two-way a game, and they know.`))
    if (low.avg < 0) add(1.6, low.id, say("pv-low" + low.id, `${name(low.id)} is on the list at ${low.avg.toFixed(1)} two-way a game, so whichever team gets them has a plan to make.`, `Whoever gets ${name(low.id)} tonight should know the average is ${low.avg.toFixed(1)} two-way. Plan accordingly.`))
  }

  return rank(items, 6)
}

export interface Split {
  teamA: string[]
  teamB: string[]
  pA: number | null
  sitting: string[]
}

// The most even split of the group the balancer can find, with the model's odds for the first side.
export function bestSplit(state: PooleanState, coming: string[]): Split | null {
  if (coming.length < 4) return null
  const size = Math.floor(coming.length / 2)
  const option = generateBalancedTeamSets(state, coming, size)[0]
  if (!option || option.teams.length < 2) return null
  const [teamA, teamB] = option.teams
  const used = new Set([...teamA, ...teamB])
  return { teamA, teamB, pA: predictRealMatchup(teamA, teamB)?.pA ?? null, sitting: coming.filter((id) => !used.has(id)) }
}
