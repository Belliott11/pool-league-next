import { currentForm, PARTS } from "@/lib/form"
import type { Parts } from "@/lib/epa"
import type { PooleanState } from "@/lib/types"

// Who is improving: how far each player's form rating (form.ts) has climbed over their last LATELY games, and which part of their game
// (shots, passes, turnovers, offensive rebounds, defense) climbed most. The form rating already leans on the league average, so a single
// big night moves it a little, not a lot; a real climb takes several good games in a row. Only players with more games than LATELY count,
// so there is a rating from before the stretch to compare with.
export const LATELY = 3

export const PART_LABEL: Record<keyof Parts, string> = { shots: "shooting", passes: "passing", turnovers: "ball security", boards: "offensive rebounds", defense: "defense" }

export interface Improver {
  id: string
  games: number
  before: number // form rating before their last LATELY games
  now: number
  change: number
  parts: Record<keyof Parts, number> // each part's change
  top: keyof Parts // the part that climbed most (or fell least)
}

export function improving(state: PooleanState): Improver[] {
  const out: Improver[] = []
  for (const r of currentForm(state).rows) {
    if (r.history.length <= LATELY) continue
    const then = r.history[r.history.length - 1 - LATELY]
    const now = r.history[r.history.length - 1]
    const parts = Object.fromEntries(PARTS.map((p) => [p, now.parts[p] - then.parts[p]])) as Record<keyof Parts, number>
    const top = [...PARTS].sort((a, b) => parts[b] - parts[a])[0]
    out.push({ id: r.id, games: r.games, before: then.mean, now: now.mean, change: now.mean - then.mean, parts, top })
  }
  return out.sort((a, b) => b.change - a.change)
}
