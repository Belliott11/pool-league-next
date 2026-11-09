import { allResults } from "@/lib/hallOfFame"
import type { RealGame } from "@/lib/real"
import type { PooleanState } from "@/lib/types"

export interface Rivalry {
  a: string // the one who leads (or the first of an even pair)
  b: string
  aWins: number
  bWins: number
  streakBy: string | null // who has won the most recent meetings in a row
  streak: number
  last: string // date of the latest meeting
}

export const MIN_MEETINGS = 4

// Pairs who keep meeting on opposite teams. Ranked by how contested they are: more meetings and a closer record first,
// so an 8-1 pile-on is not a rivalry. Games with no result are skipped.
// Pass the old site's games to count its results too.
export function rivalries(state: PooleanState, limit = 5, old: RealGame[] = []): Rivalry[] {
  const pairs = new Map<string, { a: string; b: string; wins: Record<string, number>; seq: string[]; last: string }>()
  for (const g of allResults(state, old)) {
    for (const x of g.won) {
      for (const y of g.lost) {
        const [a, b] = x < y ? [x, y] : [y, x]
        const p = pairs.get(`${a}|${b}`) ?? { a, b, wins: { [a]: 0, [b]: 0 }, seq: [], last: "" }
        const w = x
        p.wins[w]++
        p.seq.push(w)
        p.last = g.date
        pairs.set(`${a}|${b}`, p)
      }
    }
  }
  return [...pairs.values()]
    .filter((p) => p.seq.length >= MIN_MEETINGS)
    .map((p) => {
      const lead = p.wins[p.a] >= p.wins[p.b] ? [p.a, p.b] : [p.b, p.a]
      const tail = p.seq.at(-1)!
      let streak = 0
      for (let i = p.seq.length - 1; i >= 0 && p.seq[i] === tail; i--) streak++
      return { a: lead[0], b: lead[1], aWins: p.wins[lead[0]], bWins: p.wins[lead[1]], streakBy: tail, streak, last: p.last }
    })
    .sort((x, y) => {
      const heat = (r: Rivalry) => (r.aWins + r.bWins) * (1 - (r.aWins - r.bWins) / (r.aWins + r.bWins))
      return heat(y) - heat(x) || y.last.localeCompare(x.last)
    })
    .slice(0, limit)
}
