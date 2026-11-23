import { recordingStartOf } from "@/lib/recordingTime"
import type { Game, PooleanState, Review } from "@/lib/types"

// Instant replay, after the fact: during a live game anyone scoring can flag a moment ("Review that"). Each flag keeps the time it was
// tapped, so once the recording is uploaded (with its own start time, see recordingTime.ts) the moment is found in the video and the group
// can watch it again, slowed down, and settle it.

export const NOTE_MAX = 140
export const BEFORE = 8 // seconds of video before the tap: people tap a moment after the play
export const AFTER = 3

// `videoTime`: where the stream was when flagged, from a phone that was watching it (exact, so no clock is needed).
export const newReview = (at: number, note?: string, by?: string | null, videoTime?: number | null): Review => ({
  id: `rv_${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  at,
  ...(typeof videoTime === "number" && videoTime > 0 ? { videoTime: Math.round(videoTime * 10) / 10 } : {}),
  ...(note?.trim() ? { note: note.trim().slice(0, NOTE_MAX) } : {}),
  ...(by ? { by } : {}),
})

export function addReview(state: PooleanState, gameId: string, review: Review): PooleanState {
  return { ...state, games: state.games.map((g) => (g.id === gameId ? { ...g, reviews: [...(g.reviews ?? []), review] } : g)) }
}

export function updateReview(state: PooleanState, gameId: string, id: string, patch: Partial<Review> | null): PooleanState {
  return {
    ...state,
    games: state.games.map((g) =>
      g.id !== gameId ? g : { ...g, reviews: (g.reviews ?? []).flatMap((r) => (r.id !== id ? [r] : patch === null ? [] : [{ ...r, ...patch }])) },
    ),
  }
}

// Where a review is in the game's video, in seconds: set by hand, else from the recording's start time. Null until one is known.
export function reviewTime(state: PooleanState, game: Game, r: Review): number | null {
  if (typeof r.videoTime === "number") return r.videoTime
  const start = recordingStartOf(state, game)
  if (!start) return null
  const t = (r.at - start) / 1000
  return t >= 0 ? Math.round(t * 10) / 10 : null
}

// Every call settled so far, for a season tally.
export const settled = (games: Game[]) => games.flatMap((g) => (g.reviews ?? []).filter((r) => r.verdict))

export interface ReviewTally {
  flagged: number // every flagged moment
  settled: number // ones the group made a call on
  overturned: number
  players: { id: string; flagged: number; overturned: number; stood: number }[] // by who flagged it, most overturned first
}

// The season's replay reviews, all games given: how often a call is overturned, and who flags, and is right, most often.
export function reviewTally(games: Game[]): ReviewTally {
  const all = games.flatMap((g) => g.reviews ?? [])
  const by = new Map<string, { id: string; flagged: number; overturned: number; stood: number }>()
  for (const r of all) {
    if (!r.by) continue
    const p = by.get(r.by) ?? { id: r.by, flagged: 0, overturned: 0, stood: 0 }
    p.flagged++
    if (r.verdict === "overturned") p.overturned++
    if (r.verdict === "stands") p.stood++
    by.set(r.by, p)
  }
  return {
    flagged: all.length,
    settled: all.filter((r) => r.verdict).length,
    overturned: all.filter((r) => r.verdict === "overturned").length,
    players: [...by.values()].sort((a, b) => b.overturned - a.overturned || b.flagged - a.flagged || a.id.localeCompare(b.id)),
  }
}
