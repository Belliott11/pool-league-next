import type { PooleanState } from "@/lib/types"

// Things that should have been tagged and were not. A blank defender on an open shot, or a blank rebounder or turnover
// type on a stolen or blocked shot, means nothing happened, so those are not listed.
export type BlankKind = "shotType" | "location" | "rebounder" | "forcedBy"
export const BLANK_LABEL: Record<BlankKind, string> = { shotType: "Shot type", location: "Shot location", rebounder: "Who got the rebound", forcedBy: "Who forced the turnover" }

export interface Blank {
  key: string
  gameId: string
  date: string
  kind: BlankKind
  playerId: string
  time: number | null
}

export function findBlanks(state: PooleanState): Blank[] {
  const out: Blank[] = []
  for (const g of state.games) {
    if (g.liveInProgress) continue
    const base = { gameId: g.id, date: g.date }
    const shotBased = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
    for (const e of g.scoringEvents) {
      const add = (kind: BlankKind) => out.push({ ...base, key: `${e.id}-${kind}`, kind, playerId: e.scorerId, time: e.videoTime ?? null })
      if (!e.shotType) add("shotType")
      if (!e.shotLocation) add("location")
      if (e.made === false && !e.rebounderId && !e.turnoverEventId) add("rebounder")
    }
    for (const x of g.turnoverEvents) if (!shotBased.has(x.id) && !x.opponentId) out.push({ ...base, key: `${x.id}-forcedBy`, kind: "forcedBy", playerId: x.playerId, time: x.videoTime ?? null })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? 0) - (b.time ?? 0))
}
