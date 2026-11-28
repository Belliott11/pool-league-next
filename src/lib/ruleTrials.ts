import { filmedGames } from "@/lib/filmed"
import { compareGames, MIN_SIDE_GAMES, type ImpactRow } from "@/lib/ruleImpact"
import type { PooleanState, RuleTrial } from "@/lib/types"

// Trial rules: the editor names a rule to try ("3-point line moved in") and marks the nights played under it. Those nights' filmed games
// are compared with every filmed game played under no trial, on the same measures as a rulebook change (ruleImpact.ts compareGames), each
// with how sure it is. So the group can try a change for a night or two and see what it did before asking Adam to put it in the rulebook.

export interface TrialResult {
  trial: RuleTrial
  trialGames: number
  otherGames: number
  rows: ImpactRow[] // empty until both sides have MIN_SIDE_GAMES filmed games
}

export function trialResult(state: PooleanState, trial: RuleTrial): TrialResult {
  const anyTrial = new Set((state.ruleTrials ?? []).flatMap((t) => t.dates))
  const games = filmedGames(state)
  const on = games.filter((g) => trial.dates.includes(g.date))
  const off = games.filter((g) => !anyTrial.has(g.date))
  const rows = on.length >= MIN_SIDE_GAMES && off.length >= MIN_SIDE_GAMES ? compareGames(off, on) : []
  return { trial, trialGames: on.length, otherGames: off.length, rows }
}

// The trial a night was played under, if any (for a note on the night recap and game pages).
export const trialOn = (state: PooleanState, date: string | undefined) => (date ? (state.ruleTrials ?? []).find((t) => t.dates.includes(date)) ?? null : null)
