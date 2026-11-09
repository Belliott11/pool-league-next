import { timedGame, type Rate } from "@/lib/gameFlow"
import { GAP_CAP } from "@/lib/tempo"
import type { Game, PooleanState, ScoringEvent, TurnoverEvent } from "@/lib/types"

// What a shot came straight after, from the order of plays on the video. Timed games only, and the basket that ends a
// game is left out, as it is everywhere else.
export const QUICK = 5 // seconds or fewer since the previous play
const TAKEAWAY_WINDOW_SECONDS = 15 // same window as Points off Takeaways

export interface SeqLine {
  all: Rate
  putback: Rate // right after their team's offensive rebound
  offTurnover: Rate // right after the other team gave it away
  quick: Rate
  settled: Rate
  answer: Rate // their team's next shot after the other team scored
}
export interface SeqRow extends SeqLine {
  id: string
}
export interface Sequences {
  games: number
  league: SeqLine
  rows: SeqRow[]
}

const line = (): SeqLine => ({ all: r(), putback: r(), offTurnover: r(), quick: r(), settled: r(), answer: r() })
function r(): Rate {
  return { made: 0, att: 0 }
}
type Play = { t: number; who: string; shot?: ScoringEvent; tov?: TurnoverEvent }
const add = (x: Rate, made: boolean) => {
  x.att++
  if (made) x.made++
}

export function sequences(state: PooleanState): Sequences {
  const by = new Map<string, SeqLine>()
  const row = (id: string) => by.get(id) ?? by.set(id, line()).get(id)!
  const league = line()
  let games = 0
  for (const t of state.games.map(timedGame)) {
    if (!t) continue
    games++
    const g: Game = t.game
    const side = (id?: string | null) => (id && g.teamA.includes(id) ? 0 : id && g.teamB.includes(id) ? 1 : -1)
    const counted = new Set(t.counted.map((e) => e.id))
    const shotBased = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
    const plays: Play[] = [
      ...t.shots.map((e) => ({ t: e.t, who: e.scorerId, shot: e as ScoringEvent })),
      ...g.turnoverEvents.filter((x) => !shotBased.has(x.id) && typeof x.videoTime === "number").map((x) => ({ t: x.videoTime as number, who: x.playerId, tov: x })),
    ].sort((a, b) => a.t - b.t)
    const owed = [false, false] // this team has not shot since the other team scored
    plays.forEach((p, i) => {
      if (!p.shot) return
      const team = side(p.who)
      if (team < 0) return
      const made = p.shot.made !== false
      if (counted.has(p.shot.id)) {
        const lines = [league, row(p.who)]
        for (const l of lines) add(l.all, made)
        if (owed[team]) for (const l of lines) add(l.answer, made)
        const prev = plays[i - 1]
        const gap = prev ? p.t - prev.t : Infinity
        if (prev && gap <= GAP_CAP) {
          const putback = !!prev.shot && prev.shot.made === false && side(prev.who) === team && side(prev.shot.rebounderId) === team
          const off = !!prev.tov && side(prev.who) === 1 - team && gap <= TAKEAWAY_WINDOW_SECONDS
          for (const l of lines) {
            if (putback) add(l.putback, made)
            else if (off) add(l.offTurnover, made)
            else add(gap <= QUICK ? l.quick : l.settled, made)
          }
        }
      }
      owed[team] = false
      if (made) owed[1 - team] = true
    })
  }
  return { games, league, rows: [...by].map(([id, l]) => ({ id, ...l })).sort((a, b) => b.all.att - a.all.att) }
}
