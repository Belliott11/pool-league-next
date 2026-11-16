import written from "@/data/advanced-reads.json"
import type { PooleanState } from "@/lib/types"

// Reads written by hand from the numbers, saved with the site and rewritten on request. Shown on the Leaderboard's Advanced reads and
// on each player's page.
export interface WrittenRead {
  headline: string
  text: string[]
}
export const WRITTEN = written as { writtenAt: string; filmedGames: number; players: Record<string, WrittenRead> }

export const writtenRead = (id: string): WrittenRead | null => WRITTEN.players[id] ?? null

const filmedGames = (state: PooleanState) => state.games.filter((g) => !g.liveInProgress && g.scoringEvents.length > 0).length

// "Written Nov 15 from 10 filmed games.", plus how far behind it is once newer games are filmed.
export function writtenNote(state: PooleanState): string {
  const since = filmedGames(state) - WRITTEN.filmedGames
  const when = new Date(WRITTEN.writtenAt + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
  return `Written ${when} from ${WRITTEN.filmedGames} filmed games.${since > 0 ? ` ${since} more ${since === 1 ? "game has" : "games have"} been filmed since, so this is behind the numbers until it is rewritten.` : ""}`
}
