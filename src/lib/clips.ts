import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"
import type { Frame } from "@/lib/stillCache"
import { gameVideoUrl } from "@/lib/video"

// Plays worth showing: logged moments (made shots, blocks, steals) in games that have a recording, ranked by how much they look like a
// highlight. Nothing here is new data; it reads the shot log and the video times already tagged.
export interface Clip {
  gameId: string
  date: string
  time: number // seconds into the game's video
  playerId: string
  kind: "marked" | "lowlight" | "dunk" | "three" | "block" | "steal" | "beat" | "shot"
  marked?: boolean // an editor flagged it as a good clip (a highlight on the game's reel)
  from?: number // for a marked clip, the stretch the editor cut, in seconds
  to?: number
  label: string // "Dunk", "Block on Ben"
  score: number
  reviewed?: boolean // an editor looked at it and kept it
  frame?: Frame // the crop the editor set
  who?: string[] // others in the shot, so it can show on their pages too
  good?: string[] // players it flatters: ranks higher for them
  rough?: string[] // players it goes badly for: shown with stories about that, never on their highlights
}

const SCORE = { marked: 20, lowlight: 8, dunk: 6, block: 5, three: 4, beat: 4, steal: 3, shot: 1 } as const

const hasVideo = (state: PooleanState, g: Game) => !!gameVideoUrl(state, g)

// The meaningful words in a line, for matching a headline to what a clip shows.
const STOP = new Set(["the", "and", "with", "from", "that", "this", "for", "his", "her", "their", "was", "were", "has", "have", "had", "over", "after", "into"])
export const words = (t: string) => [...new Set((t.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)))]

export const reviewKey = (c: { time: number; playerId: string }) => `${Math.round(c.time)}|${c.playerId}`

// Every clip in one game, each tied to a player, with the editor's reviews applied: skipped ones gone, kept ones crowned and cropped.
export function gameClips(state: PooleanState, g: Game): Clip[] {
  const reviews = new Map((g.clipReviews ?? []).map((r) => [r.key, r]))
  return rawClips(state, g).flatMap((c) => {
    const r = reviews.get(reviewKey(c))
    if (!r) return [c]
    if (r.verdict === "skip") return []
    const looks = Object.entries(r.looks ?? {})
    return [{ ...c, label: r.note?.trim() || c.label, reviewed: true, frame: r.frame, who: r.who, good: looks.filter(([, v]) => v === "good").map(([id]) => id), rough: looks.filter(([, v]) => v === "bad").map(([id]) => id) }]
  })
}

// Every candidate in one game before any review: the scorer, the blocker or the thief.
export function rawClips(state: PooleanState, g: Game): Clip[] {
  if (!hasVideo(state, g) || g.liveInProgress) return []
  const out: Clip[] = []
  const base = { gameId: g.id, date: g.date }
  // Highlights the editor marked on the game's reel come first, and an automatic clip of the same moment is dropped.
  const marked: Clip[] = (g.plays ?? [])
    .filter((p) => p.type === "highlight" && p.playerId && p.end > p.start)
    .map((p) => ({ ...base, time: p.start + Math.min(5, (p.end - p.start) / 2), from: p.start, to: Math.min(p.end, p.start + 12), playerId: p.playerId!, kind: "marked" as const, marked: true, label: p.note?.trim() || "Marked highlight", score: SCORE.marked }))
  // A play an editor flagged as a lowlight is the same thing the other way round: a rough moment, for stories about things going badly.
  const low: Clip[] = (g.plays ?? [])
    .filter((p) => p.type === "lowlight" && p.playerId && p.end > p.start)
    .map((p) => ({ ...base, time: p.start + Math.min(5, (p.end - p.start) / 2), from: p.start, to: Math.min(p.end, p.start + 12), playerId: p.playerId!, kind: "lowlight" as const, label: p.note?.trim() || "Rough moment", score: SCORE.lowlight, rough: [p.playerId!] }))
  out.push(...marked, ...low)
  const taken = (t: number, id: string) => marked.some((m) => m.playerId === id && t >= m.from! - 3 && t <= m.to! + 3)
  for (const e of g.scoringEvents) {
    if (typeof e.videoTime !== "number") continue
    if (taken(e.videoTime, e.scorerId) || (e.blockerId && taken(e.videoTime, e.blockerId))) continue
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
    if (typeof s.videoTime !== "number" || taken(s.videoTime, s.playerId)) continue
    out.push({ ...base, time: s.videoTime, playerId: s.playerId, kind: "steal", label: `Steal from ${playerName(state, s.opponentId)}`, score: SCORE.steal })
  }
  return out
}

export const clipKey = (c: Clip) => `${c.gameId}|${c.time}|${c.playerId}`

// The best few across games (a clip an editor marked always outranks the rest), picked one at a time so the set is varied: each pick costs the next ones of the same kind of play and
// the same player a little, so a strip is not three blocks or one player's whole night. At most `perGame` from one game. `kinds`
// limits what counts, and `skip` holds clips already used elsewhere on the page.
export function bestClips(state: PooleanState, opts: { pid?: string; mood?: "bad"; about?: string; gameIds?: string[]; limit?: number; perGame?: number; kinds?: Clip["kind"][]; skip?: Set<string> } = {}): Clip[] {
  const { pid, gameIds, limit = 3, perGame = 2, kinds, skip, mood, about } = opts
  let pool = state.games
    .filter((g) => !gameIds || gameIds.includes(g.id))
    .flatMap((g) => gameClips(state, g))
    .filter((c) => (!pid || c.playerId === pid || c.who?.includes(pid)) && (mood === "bad" ? !!pid && !!c.rough?.includes(pid) : !c.rough?.some((r) => r === pid || r === c.playerId)) && (!kinds || kinds.includes(c.kind)) && !skip?.has(clipKey(c)))
    .sort((a, b) => b.score - a.score || b.date.localeCompare(a.date) || a.time - b.time)
  const out: Clip[] = []
  const count = (f: (c: Clip) => boolean) => out.filter(f).length
  while (out.length < limit && pool.length) {
    const open = pool.filter((c) => count((o) => o.gameId === c.gameId) < perGame)
    if (!open.length) break
    // Earlier in the sorted pool wins a tie, so the order above still decides between equals.
    const said = about ? words(about) : null
    const worth = (c: Clip) => (said ? 5 * words(c.label).filter((w) => said.includes(w)).length : 0) + c.score + (c.marked ? 100 : c.reviewed ? 60 : 0) + (pid && c.good?.includes(pid) ? 8 : 0) - 2 * count((o) => o.kind === c.kind) - 1.5 * count((o) => o.playerId === c.playerId)
    const pick = open.reduce((best, c) => (worth(c) > worth(best) ? c : best))
    out.push(pick)
    pool = pool.filter((c) => c !== pick)
  }
  return out
}
