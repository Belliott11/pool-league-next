import type { PooleanState } from "@/lib/types"

// Things that should have been tagged and were not. A blank defender on an open shot, a blank rebounder or turnover type
// on a stolen or blocked shot, or a turnover with nobody forcing it (a teammate deflecting a pass out of bounds) means
// nothing happened, so those are not listed. A free throw has no shot type or spot, a dunk is its own shot type, and a blocked shot can go out of bounds with no rebound.
export type BlankKind = "shotType" | "location" | "rebounder" | "catch"
export const BLANK_LABEL: Record<BlankKind, string> = { shotType: "Shot type", location: "Shot location", rebounder: "Who got the rebound", catch: "Catch and shoot or held it" }

export interface Blank {
  key: string
  eventId: string
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
    for (const e of g.scoringEvents) {
      const add = (kind: BlankKind) => out.push({ ...base, key: `${e.id}-${kind}`, eventId: e.id, kind, playerId: e.scorerId, time: e.videoTime ?? null })
      const freeThrow = e.points === 1
      if (!freeThrow && !e.shotType && !e.dunk) add("shotType")
      if (!freeThrow && !e.shotLocation) add("location")
      if (e.made === false && !e.rebounderId && !e.turnoverEventId && !e.blockerId) add("rebounder")
      const passer = e.made !== false ? e.assistId : e.passerId
      if (!freeThrow && passer && passer !== "none" && passer !== e.scorerId && (e.catchAndShoot === null || e.catchAndShoot === undefined)) add("catch")
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? 0) - (b.time ?? 0))
}
