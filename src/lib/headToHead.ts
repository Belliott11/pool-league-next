import { realSeasonsInOrder } from "@/lib/real"
import { playerLine, scoreOf } from "@/lib/nightRecap"
import type { Game, PooleanState } from "@/lib/types"

export interface Meeting {
  game: Game
  date: string
  aScore: number // the score of a's team
  bScore: number
}

export interface HeadToHead {
  meetings: Meeting[] // oldest first
  aWins: number
  bWins: number
  aPts: number // average points each scored when they faced each other
  bPts: number
  togetherWins: number
  togetherLosses: number
}

const finished = (g: Game) => !g.liveInProgress && !!g.date

// Everything between two players: games on opposite teams, and games on the same team.
export function headToHead(state: PooleanState, a: string, b: string): HeadToHead {
  const meetings: Meeting[] = []
  let togetherWins = 0
  let togetherLosses = 0
  for (const g of [...state.games].filter(finished).sort((x, y) => x.date.localeCompare(y.date))) {
    const [sa, sb] = scoreOf(g)
    const aOnA = g.teamA.includes(a)
    const aOnB = g.teamB.includes(a)
    const bOnA = g.teamA.includes(b)
    const bOnB = g.teamB.includes(b)
    if ((aOnA && bOnB) || (aOnB && bOnA)) meetings.push({ game: g, date: g.date, aScore: aOnA ? sa : sb, bScore: aOnA ? sb : sa })
    else if ((aOnA && bOnA) || (aOnB && bOnB)) {
      const mine = aOnA ? sa : sb
      const theirs = aOnA ? sb : sa
      if (mine > theirs) togetherWins++
      else if (mine < theirs) togetherLosses++
    }
  }
  const avg = (id: string) => (meetings.length ? meetings.reduce((n, m) => n + playerLine(m.game, id).pts, 0) / meetings.length : 0)
  return {
    meetings,
    aWins: meetings.filter((m) => m.aScore > m.bScore).length,
    bWins: meetings.filter((m) => m.bScore > m.aScore).length,
    aPts: avg(a),
    bPts: avg(b),
    togetherWins,
    togetherLosses,
  }
}

// The two players who have faced each other most, as a starting pick for the matchup card.
export function mostMetPair(state: PooleanState): [string, string] | null {
  const n = new Map<string, number>()
  for (const g of state.games.filter(finished)) {
    for (const x of g.teamA) {
      for (const y of g.teamB) {
        const k = x < y ? `${x}|${y}` : `${y}|${x}`
        n.set(k, (n.get(k) ?? 0) + 1)
      }
    }
  }
  const best = [...n.entries()].sort((p, q) => q[1] - p[1])[0]
  return best ? (best[0].split("|") as [string, string]) : null
}

// Every result on record (the old site's list holds every game, filmed or not): x's record against y, and the two as teammates.
export function pairRecord(x: string, y: string): { vs: [number, number]; together: [number, number] } {
  const out = { vs: [0, 0] as [number, number], together: [0, 0] as [number, number] }
  for (const s of realSeasonsInOrder())
    for (const g of s.games) {
      const xa = g.a.includes(x), xb = g.b.includes(x), ya = g.a.includes(y), yb = g.b.includes(y)
      const xWon = (xa && g.w === "A") || (xb && g.w === "B")
      if ((xa && yb) || (xb && ya)) out.vs[xWon ? 0 : 1]++
      else if ((xa && ya) || (xb && yb)) out.together[xWon ? 0 : 1]++
    }
  return out
}
