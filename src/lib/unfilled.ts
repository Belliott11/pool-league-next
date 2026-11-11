import { tipoffStatus } from "@/lib/matchupSets"
import type { PooleanState } from "@/lib/types"

// What each filmed game still lacks for the newer stats, in one list: tip-off matchups (the Matchup Record and Who Guards Whom) and a
// contest level on shots that have a defender tagged (Beat Rate, Def Load and the contest panels read it). The per-play blanks live in
// Fix blanks. A game with nothing missing is left out.
export interface Unfilled {
  gameId: string
  date: string
  tipoff: { assigned: number; total: number } | null // null when everyone has someone at tip-off
  noContest: number // shots with a defender but no contest level
  shots: number
}

export function findUnfilled(state: PooleanState): Unfilled[] {
  const out: Unfilled[] = []
  for (const g of state.games) {
    if (g.liveInProgress || g.scoringEvents.length === 0) continue
    const t = tipoffStatus(g)
    const shots = g.scoringEvents.filter((e) => (e.points === 2 || e.points === 3) && (e.defenderIds ?? []).length > 0)
    const noContest = shots.filter((e) => !e.contestLevel).length
    if (t.missing.length === 0 && noContest === 0) continue
    out.push({ gameId: g.id, date: g.date, tipoff: t.missing.length ? { assigned: t.assigned, total: t.total } : null, noContest, shots: shots.length })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
