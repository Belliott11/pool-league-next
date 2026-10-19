import { gameDays } from "@/lib/nightRecap"
import type { PooleanState } from "@/lib/types"

export interface Attendance {
  id: string
  nights: number // nights played
  pct: number // of all nights with a game
  recent: number // of the last RECENT nights
}

export const RECENT = 5
export const REGULAR_PCT = 60

// How often each player shows up: share of all game nights, and of the last few. Needs a few nights to mean anything.
export function attendance(state: PooleanState): { total: number; rows: Attendance[] } {
  const days = gameDays(state)
  const lastDays = new Set(days.slice(0, RECENT))
  const seen = new Map<string, Set<string>>()
  for (const g of state.games) {
    if (g.liveInProgress || !g.date) continue
    for (const id of [...g.teamA, ...g.teamB]) seen.set(id, (seen.get(id) ?? new Set()).add(g.date))
  }
  const rows = state.players
    .map((p) => {
      const d = seen.get(p.id) ?? new Set<string>()
      return { id: p.id, nights: d.size, pct: days.length ? Math.round((d.size / days.length) * 100) : 0, recent: [...d].filter((x) => lastDays.has(x)).length }
    })
    .filter((r) => r.nights > 0)
    .sort((a, b) => b.pct - a.pct || b.recent - a.recent)
  return { total: days.length, rows }
}

// What the sign-ups mean for the night: can the teams be even, and which regulars have not answered.
export function turnout(state: PooleanState, coming: string[]): { teams: string; missing: string[] } {
  const n = coming.length
  const teams = n < 2 ? "Not enough yet for a game" : n % 2 === 0 ? `Even teams: ${n / 2} v ${n / 2}` : n === 3 ? "3 is awkward: one sits, or 2 v 1" : `Odd number: ${Math.ceil(n / 2)} v ${Math.floor(n / 2)}, or one sits`
  const { total, rows } = attendance(state)
  const here = new Set(coming)
  const missing = total >= 4 ? rows.filter((r) => r.pct >= REGULAR_PCT && !here.has(r.id)).map((r) => r.id) : []
  return { teams, missing }
}
