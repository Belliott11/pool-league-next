import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"
import { gameVideoUrl } from "@/lib/video"

// Plays worth showing: logged moments (made shots, blocks, steals) in games that have a recording, ranked by how much they look like a
// highlight. Nothing here is new data; it reads the shot log and the video times already tagged.
export interface Clip {
  gameId: string
  date: string
  time: number // seconds into the game's video
  playerId: string
  kind: "dunk" | "three" | "block" | "steal" | "beat" | "shot"
  label: string // "Dunk", "Block on Ben"
  score: number
}

const SCORE = { dunk: 6, block: 5, three: 4, beat: 4, steal: 3, shot: 1 } as const

const hasVideo = (state: PooleanState, g: Game) => !!gameVideoUrl(state, g)

// Every clip in one game, each tied to a player: the scorer, the blocker or the thief.
export function gameClips(state: PooleanState, g: Game): Clip[] {
  if (!hasVideo(state, g) || g.liveInProgress) return []
  const out: Clip[] = []
  const base = { gameId: g.id, date: g.date }
  for (const e of g.scoringEvents) {
    if (typeof e.videoTime !== "number") continue
    const made = e.made !== false
    if (e.blockerId && !made) {
      out.push({ ...base, time: e.videoTime, playerId: e.blockerId, kind: "block", label: `Block on ${playerName(state, e.scorerId)}`, score: SCORE.block })
    }
    if (!made) continue
    const heavy = e.contestLevel === "heavy" || e.contestLevel === "medium"
    const kind: Clip["kind"] = e.dunk ? "dunk" : e.points === 3 ? "three" : e.contestLevel === "beat" ? "beat" : "shot"
    const label = e.dunk ? "Dunk" : e.points === 3 ? (heavy ? "Contested three" : "Three") : e.contestLevel === "beat" ? "Beat the defender and finished" : heavy ? "Contested bucket" : "Bucket"
    out.push({ ...base, time: e.videoTime, playerId: e.scorerId, kind, label, score: SCORE[kind] + (heavy ? 2 : 0) + (e.assistId ? 0.5 : 0) })
  }
  for (const s of g.stealEvents) {
    if (typeof s.videoTime !== "number") continue
    out.push({ ...base, time: s.videoTime, playerId: s.playerId, kind: "steal", label: `Steal from ${playerName(state, s.opponentId)}`, score: SCORE.steal })
  }
  return out
}

export const clipKey = (c: Clip) => `${c.gameId}|${c.time}|${c.playerId}`

// The best few across games, picked one at a time so the set is varied: each pick costs the next ones of the same kind of play and
// the same player a little, so a strip is not three blocks or one player's whole night. At most `perGame` from one game. `kinds`
// limits what counts, and `skip` holds clips already used elsewhere on the page.
export function bestClips(state: PooleanState, opts: { pid?: string; gameIds?: string[]; limit?: number; perGame?: number; kinds?: Clip["kind"][]; skip?: Set<string> } = {}): Clip[] {
  const { pid, gameIds, limit = 3, perGame = 2, kinds, skip } = opts
  let pool = state.games
    .filter((g) => !gameIds || gameIds.includes(g.id))
    .flatMap((g) => gameClips(state, g))
    .filter((c) => (!pid || c.playerId === pid) && (!kinds || kinds.includes(c.kind)) && !skip?.has(clipKey(c)))
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || a.time - b.time)
  const out: Clip[] = []
  const count = (f: (c: Clip) => boolean) => out.filter(f).length
  while (out.length < limit && pool.length) {
    const open = pool.filter((c) => count((o) => o.gameId === c.gameId) < perGame)
    if (!open.length) break
    // Earlier in the sorted pool wins a tie, so the order above still decides between equals.
    const pick = open.reduce((best, c) => (c.score - 2 * count((o) => o.kind === c.kind) - 1.5 * count((o) => o.playerId === c.playerId) > best.score - 2 * count((o) => o.kind === best.kind) - 1.5 * count((o) => o.playerId === best.playerId) ? c : best))
    out.push(pick)
    pool = pool.filter((c) => c !== pick)
  }
  return out
}
