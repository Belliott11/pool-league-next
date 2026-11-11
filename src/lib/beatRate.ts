import { isBalancedGame } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// Beat Rate: how often a defender was the one beaten, out of every shot they were tagged on. A "beat" shot is a scoring event
// with contestLevel "beat": the defender was out of the play (not back, out of position, or away from the shot). It is a
// defensive effort stat, so it is never shown as a shooter's skill; for the shooter it is labelled "breakdown shots".
export const TRANSITION_SECONDS = 8 // a shot this soon after a turnover or steal is a transition shot

export interface BeatRow {
  id: string
  faced: number
  beat: number
  tFaced: number // shots in transition
  tBeat: number
  hFaced: number // shots in the half court
  hBeat: number
  oppMade: number // makes against them, leaving out beat shots
  oppAtt: number
}

// The same games as the other per-game defensive rates: balanced teams, not stopped early, a real shot log.
export const countsForBeatRate = (g: Game) => !g.liveInProgress && !g.stoppedEarly && g.scoringEvents.length > 0 && isBalancedGame(g)

// Whether a shot came straight off a turnover or steal: the latest logged event before it (a shot, turnover or steal, in video
// time) was one of those, within TRANSITION_SECONDS. A turnover that is the shot itself (a stolen or blocked shot) is not before it.
export function isTransition(g: Game, shot: Game["scoringEvents"][number]): boolean {
  if (typeof shot.videoTime !== "number") return false
  const before: { t: number; loss: boolean }[] = []
  for (const e of g.scoringEvents) if (e.id !== shot.id && typeof e.videoTime === "number" && e.videoTime < shot.videoTime) before.push({ t: e.videoTime, loss: false })
  for (const x of g.turnoverEvents) if (x.id !== shot.turnoverEventId && typeof x.videoTime === "number" && x.videoTime < shot.videoTime) before.push({ t: x.videoTime, loss: true })
  for (const x of g.stealEvents) if (typeof x.videoTime === "number" && x.videoTime < shot.videoTime) before.push({ t: x.videoTime, loss: true })
  if (before.length === 0) return false
  const latest = Math.max(...before.map((b) => b.t))
  // A steal and its paired turnover sit at the same moment; either one makes the latest event a loss.
  return before.some((b) => b.t === latest && b.loss) && shot.videoTime - latest <= TRANSITION_SECONDS
}

export function beatRates(state: PooleanState, only?: string): BeatRow[] {
  const by = new Map<string, BeatRow>()
  const row = (id: string) => by.get(id) ?? by.set(id, { id, faced: 0, beat: 0, tFaced: 0, tBeat: 0, hFaced: 0, hBeat: 0, oppMade: 0, oppAtt: 0 }).get(id)!
  for (const g of state.games.filter(countsForBeatRate)) {
    for (const e of g.scoringEvents) {
      if (e.points !== 2 && e.points !== 3) continue
      const beat = e.contestLevel === "beat"
      const trans = isTransition(g, e)
      // A double team splits the shot: each of two defenders carries half of it.
      const w = defenderShare(e)
      for (const d of e.defenderIds ?? []) {
        if (only && d !== only) continue
        const r = row(d)
        r.faced += w
        if (trans) r.tFaced += w
        else r.hFaced += w
        if (beat) {
          r.beat += w
          if (trans) r.tBeat += w
          else r.hBeat += w
        } else {
          r.oppAtt += w
          if (e.made !== false) r.oppMade += w
        }
      }
    }
  }
  return [...by.values()]
}

// Each tagged defender's share of a shot: the whole shot for one defender, half each for a double team.
export const defenderShare = (e: Game["scoringEvents"][number]) => 1 / Math.max(1, e.defenderIds?.length ?? 0)
// A count that can be split by double teams, shown whole when it is whole.
export const count = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

export const rate = (n: number, d: number): number | null => (d > 0 ? n / d : null)
