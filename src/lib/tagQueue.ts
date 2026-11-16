import { BLANK_LABEL, findBlanks, type BlankKind } from "@/lib/blanks"
import { findUnfilled } from "@/lib/unfilled"
import type { PooleanState } from "@/lib/types"

// One list of every kind of missing tag across all filmed games, biggest pile first, with the stats each one feeds. The plays
// themselves are fixed in Fix blanks and Still unfilled; this says where to start.
export interface TagRow {
  label: string
  count: number
  games: number
  feeds: string
}

const FEEDS: Record<BlankKind, string> = {
  shotType: "Shot quality and the shot mix",
  location: "Shot quality and the shot charts",
  rebounder: "Rebounding and Fought REB",
  catch: "Pass quality and Real AST",
}

export function tagQueue(state: PooleanState): TagRow[] {
  const blanks = findBlanks(state)
  const unfilled = findUnfilled(state)
  const rows: TagRow[] = (Object.keys(FEEDS) as BlankKind[]).map((k) => {
    const mine = blanks.filter((b) => b.kind === k)
    return { label: BLANK_LABEL[k], count: mine.length, games: new Set(mine.map((b) => b.gameId)).size, feeds: FEEDS[k] }
  })
  const contest = unfilled.filter((u) => u.noContest > 0)
  rows.push({ label: "Contest level on a defended shot", count: contest.reduce((s, u) => s + u.noContest, 0), games: contest.length, feeds: "Beat rate, Def load and Opp FG%" })
  const tip = unfilled.filter((u) => u.tipoff)
  rows.push({ label: "Tip-off matchups", count: tip.reduce((s, u) => s + (u.tipoff!.total - u.tipoff!.assigned), 0), games: tip.length, feeds: "Matchup record and Who guards whom" })
  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count)
}

// How many tags one game still lacks, shown while logging it.
export function tagsLeft(state: PooleanState, gameId: string): number {
  const u = findUnfilled(state).find((x) => x.gameId === gameId)
  return findBlanks(state).filter((b) => b.gameId === gameId).length + (u?.noContest ?? 0) + (u?.tipoff ? u.tipoff.total - u.tipoff.assigned : 0)
}
