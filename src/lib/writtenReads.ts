import written from "@/data/advanced-reads.json"
import { FORMULA_VERSION } from "@/lib/formulaVersion"
import { isDefaultFilters } from "@/lib/filters"
import type { PooleanState } from "@/lib/types"

// Reads written by hand from the numbers, saved with the site and rewritten on request. Shown on the Leaderboard's Advanced reads and
// on each player's page.
export interface WrittenRead {
  headline: string
  text: string[]
  strengths?: string // shown on the Scouting Card
  workOn?: string[] // what to work on, a few plain lines
  guard?: string // how to guard them
  season?: string // the season in a sentence, for Season Wrapped
}
export const WRITTEN = written as { writtenAt: string; filmedGames: number; formula?: number; players: Record<string, WrittenRead> }

export const writtenRead = (id: string): WrittenRead | null => WRITTEN.players[id] ?? null
// The written read, but only with the default Filters: its numbers were written for those. With any other filter the pages show the read
// worked out live from the numbers (advancedReads), which follows the filters.
export const writtenReadFor = (id: string): WrittenRead | null => (isDefaultFilters() ? writtenRead(id) : null)

const filmedGames = (state: PooleanState) => state.games.filter((g) => !g.liveInProgress && g.scoringEvents.length > 0).length

export const readsBehind = (state: PooleanState) => Math.max(0, filmedGames(state) - WRITTEN.filmedGames)
// True when a stat formula or filter rule changed after these were written, so numbers quoted in them may not match the panels.
export const readsFormulaStale = () => (WRITTEN.formula ?? 0) < FORMULA_VERSION

// "Written Nov 15 from 10 filmed games.", plus how far behind it is once newer games are filmed.
export function writtenNote(state: PooleanState): string {
  const since = filmedGames(state) - WRITTEN.filmedGames
  const when = new Date(WRITTEN.writtenAt + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const behind = since > 0 ? ` ${since} more ${since === 1 ? "game has" : "games have"} been filmed since, so this is behind the numbers until it is rewritten.` : ""
  const formula = readsFormulaStale() ? " A stat formula has changed since, so numbers in the text may not match the panels until it is rewritten." : ""
  if (!isDefaultFilters()) return "Your Filters are not the default ones, so this is worked out live from the numbers and follows them. The written read comes back with the default Filters."
  return `Written ${when} from ${WRITTEN.filmedGames} filmed games.${behind}${formula}`
}
