import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"

// When the ball changes hands during a clip, from the shot log, so the editor can follow whoever has it: tap the player at the start,
// then at each change. The log has the shot's time but not the pass's or the rebound's, so those are placed a moment before or after the
// shot and marked `about`.
export interface BallMoment {
  t: number
  who: string | null // who has the ball from here; null while it is in the air (a shot)
  label: string
  about?: boolean // the time is a guess around the logged shot
}

const PASS_BEFORE = 1.5 // seconds before a shot the pass usually arrives
const REBOUND_AFTER = 1.2 // seconds after a missed shot it is usually rebounded

const real = (id: string | null | undefined): id is string => !!id && id !== "none"

type Change = BallMoment & { had: string | null } // `had`: who had the ball just before this change

export function ballMoments(state: PooleanState, game: Game, from: number, to: number): { start: string | null; moments: BallMoment[] } {
  const name = (id: string) => playerName(state, id)
  const all: Change[] = []
  for (const e of game.scoringEvents) {
    if (typeof e.videoTime !== "number") continue
    const t = e.videoTime
    if (real(e.passerId) && e.passerId !== e.scorerId) all.push({ t: t - PASS_BEFORE, who: e.scorerId, had: e.passerId, label: `${name(e.passerId)} passes to ${name(e.scorerId)}`, about: true })
    all.push({ t, who: null, had: e.scorerId, label: `${name(e.scorerId)} shoots and ${e.made === false ? "misses" : "scores"}` })
    if (e.made === false && real(e.rebounderId)) all.push({ t: t + REBOUND_AFTER, who: e.rebounderId, had: null, label: `${name(e.rebounderId)} gets the rebound`, about: true })
  }
  for (const s of game.stealEvents) {
    if (typeof s.videoTime === "number") all.push({ t: s.videoTime, who: s.playerId, had: s.opponentId, label: `${name(s.playerId)} steals it from ${name(s.opponentId)}` })
  }
  all.sort((a, b) => a.t - b.t)
  const inside = all.filter((m) => m.t >= from - 0.25 && m.t <= to + 0.25)
  // Who has it as the clip starts: whoever the first change in it takes the ball from, else whoever the last change before it gave it to.
  const start = inside[0]?.had ?? [...all].reverse().find((m) => m.t < from && m.who)?.who ?? null
  return { start, moments: inside.map(({ t, who, label, about }) => ({ t: Math.min(to, Math.max(from, t)), who, label, ...(about ? { about } : {}) })) }
}
