import { currentForm } from "@/lib/form"
import { backtestPick } from "@/lib/matchup"
import type { PooleanState } from "@/lib/types"

// Should the team balancer use the form rating (form.ts)? Today it ranks splits by the pre-game model (matchup.ts), which waits for about
// 100 games before it changes. This keeps score: on every filmed game, called only from earlier nights, did the side with the higher
// combined form rating win, and did the pre-game read's favourite win? The balancer shows each split's form beside its odds, but keeps
// ranking by the read until form has done better over READY_AT games.
export const READY_AT = 30

// Each player's form rating, worked out once per copy of the league data.
const cache = new WeakMap<PooleanState, Map<string, number>>()
export function formOf(state: PooleanState): Map<string, number> {
  const kept = cache.get(state)
  if (kept) return kept
  const m = new Map(currentForm(state).rows.map((r) => [r.id, r.mean]))
  cache.set(state, m)
  return m
}
export const teamForm = (state: PooleanState, ids: string[]) => ids.reduce((a, id) => a + (formOf(state).get(id) ?? 0), 0)

export interface FormVsRead {
  games: number // games both could call (form needs an earlier filmed night)
  formRight: number
  readRight: number
}

export function formVsRead(state: PooleanState): FormVsRead {
  let games = 0
  let formRight = 0
  let readRight = 0
  const byDate = new Map<string, Map<string, number>>()
  for (const g of state.games) {
    if (!g.scoringEvents.length || g.liveInProgress || g.test || (g.winner !== "A" && g.winner !== "B")) continue
    const read = backtestPick(g)
    if (read === undefined) continue
    let form = byDate.get(g.date)
    if (!form) {
      const before = { ...state, games: state.games.filter((x) => (x.date || "") < g.date) }
      form = new Map(currentForm(before).rows.map((r) => [r.id, r.mean]))
      byDate.set(g.date, form)
    }
    if (!form.size) continue
    const sum = (t: string[]) => t.reduce((a, id) => a + (form!.get(id) ?? 0), 0)
    const diff = sum(g.teamA) - sum(g.teamB)
    if (diff === 0) continue
    games++
    if ((diff > 0) === (g.winner === "A")) formRight++
    if ((read > 0.5) === (g.winner === "A")) readRight++
  }
  return { games, formRight, readRight }
}
