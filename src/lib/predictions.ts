import type { SupabaseClient } from "@supabase/supabase-js"
import { awardRace } from "@/lib/awardRace"
import { oldRanksBetween } from "@/lib/oldSite"
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

// Preseason predictions: before opening night, everyone calls the award winners and the top three. They live in their
// own table (supabase/predictions.sql), keyed by the opening night date, and are scored as the new season plays out.
export interface Picks {
  mvp?: string
  dpoy?: string
  mip?: string
  duo?: string // two player ids joined by "|", sorted
  top3?: string[]
  ranking?: string[] // a preseason power ranking, best first
}
export interface Entry {
  voter: string
  picks: Picks
}

export const AWARD_PICKS = [
  { key: "mvp", label: "MVP" },
  { key: "dpoy", label: "Defender" },
  { key: "mip", label: "Most improved" },
] as const

export const AWARD_POINTS = 2
export const EXACT_POINTS = 3
export const TOP3_POINTS = 1

export async function loadPredictions(client: SupabaseClient, season: string): Promise<Entry[]> {
  const { data, error } = await client.from("season_predictions").select("voter,picks").eq("season", season)
  if (error || !data) return []
  return data.map((r) => ({ voter: String(r.voter), picks: (r.picks ?? {}) as Picks }))
}

// Every season's entries, for scoring past seasons.
export async function loadAllPredictions(client: SupabaseClient): Promise<(Entry & { season: string })[]> {
  const { data, error } = await client.from("season_predictions").select("season,voter,picks")
  if (error || !data) return []
  return data.map((r) => ({ season: String(r.season), voter: String(r.voter), picks: (r.picks ?? {}) as Picks }))
}

export async function savePrediction(client: SupabaseClient, season: string, voter: string, picks: Picks): Promise<boolean> {
  const { error } = await client.from("season_predictions").upsert({ season, voter, picks, updated_at: new Date().toISOString() }, { onConflict: "season,voter" })
  return !error
}

export interface ConsensusRow {
  id: string
  avg: number // average spot across the ballots that rank them, 1 is best
  firsts: number
  voters: number
}

// The group's power ranking. Every ballot ranks everyone; a player's spot is their average place across ballots. Ties
// go to whoever has more first-place votes, then more ballots.
export function consensusRanking(entries: Entry[]): ConsensusRow[] {
  const rows = new Map<string, { id: string; sum: number; firsts: number; voters: number }>()
  for (const e of entries) {
    const seen = new Set<string>()
    ;(e.picks.ranking ?? []).forEach((id) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      const r = rows.get(id) ?? { id, sum: 0, firsts: 0, voters: 0 }
      r.sum += seen.size
      if (seen.size === 1) r.firsts++
      r.voters++
      rows.set(id, r)
    })
  }
  return [...rows.values()]
    .map((r) => ({ id: r.id, avg: r.sum / r.voters, firsts: r.firsts, voters: r.voters }))
    .sort((a, b) => a.avg - b.avg || b.firsts - a.firsts || b.voters - a.voters)
}

// A ballot over exactly this pool: the saved order first (anyone no longer in the pool dropped), then anyone new in the
// fallback order.
export function ballotFor(pool: string[], saved: string[] | undefined, fallback: string[]): string[] {
  const inPool = new Set(pool)
  const kept = (saved ?? []).filter((id, i, a) => inPool.has(id) && a.indexOf(id) === i)
  const rest = [...fallback.filter((id) => inPool.has(id)), ...pool].filter((id, i, a) => !kept.includes(id) && a.indexOf(id) === i)
  return [...kept, ...rest]
}

export const duoKey = (a: string, b: string) => [a, b].sort().join("|")

export interface Actual {
  mvp?: string
  dpoy?: string
  mip?: string
  duo?: string
  top3: string[]
}

// The season that started on opening night, up to (not including) the next one's.
const seasonFrom = (state: PooleanState, from: string, to?: string): PooleanState => ({
  ...state,
  games: state.games.filter((g) => g.date >= from && (to === undefined || g.date < to)),
  currentSeasonStartedAt: from,
})

// The order for that season: two-way per 25 over at least 3 games. Where the old site has power rankings from nights inside
// the season, each player's two-way spot (0 to 100) is averaged with their old power percentile, so players whose games
// were never filmed are scored too. Seasons the old site did not cover are ordered by two-way alone.
export function actualOrder(state: PooleanState, from: string, to?: string): string[] {
  const rated = computeLeaderboard(seasonFrom(state, from, to))
    .filter((r) => r.gp >= 3)
    .sort((a, b) => b.twoWayPer25 - a.twoWayPer25)
    .map((r) => r.player.id)
  const old = oldRanksBetween(from, to)
  if (old.size === 0) return rated
  const own = new Map(rated.map((id, i) => [id, rated.length > 1 ? (1 - i / (rated.length - 1)) * 100 : 50]))
  const known = new Set(state.players.map((p) => p.id))
  return [...new Set([...own.keys(), ...old.keys()])]
    .filter((id) => known.has(id))
    .map((id) => {
      const parts = [own.get(id), old.get(id)].filter((x): x is number => x !== undefined)
      return { id, score: parts.reduce((a, b) => a + b, 0) / parts.length }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((r) => r.id)
}

// Who leads right now in the season that started on opening night.
export function actualResults(state: PooleanState, from: string, to?: string): Actual {
  const rows = awardRace(seasonFrom(state, from, to))
  const lead = (key: string) => rows.find((r) => r.key === key)?.leaders[0]?.ids
  const duo = lead("best-duo")
  return { mvp: lead("mvp")?.[0], dpoy: lead("dpoy")?.[0], mip: lead("mip")?.[0], duo: duo && duo.length === 2 ? duoKey(duo[0], duo[1]) : undefined, top3: actualOrder(state, from, to).slice(0, 3) }
}

export interface PastSeason {
  season: string
  ballot?: { voter: string; miss: number }
  picks?: { voter: string; points: number }
}

// Finished seasons, newest first: each one runs from its opening night to the next. A season is finished once a later
// opening night has been set. Each gets its closest power ranking ballot and its best set of predictions.
export function pastSeasons(state: PooleanState, all: (Entry & { season: string })[]): PastSeason[] {
  const keys = [...new Set([...all.map((e) => e.season), ...(state.openingNight?.date ? [state.openingNight.date] : [])])].sort()
  return keys
    .slice(0, -1)
    .map((season, i) => {
      const next = keys[i + 1]
      const entries = all.filter((e) => e.season === season)
      const ballot = scoreBallots(entries, actualOrder(state, season, next))[0]
      const best = scorePredictions(entries, actualResults(state, season, next))[0]
      return { season, ballot, picks: best && best.points > 0 ? best : undefined }
    })
    .filter((p) => p.ballot || p.picks)
    .reverse()
}

// A ballot cut down to the players in the standings, renumbered 1, 2, 3 in its own order.
const spotsOn = (ballot: string[], order: string[]): Map<string, number> => {
  const inOrder = new Set(order)
  const kept = ballot.filter((id, i) => inOrder.has(id) && ballot.indexOf(id) === i)
  return new Map(kept.map((id, i) => [id, i + 1]))
}

// How close each power ranking ballot came: the average number of spots it missed each ranked player by. Lower is
// better; a ballot must cover at least 3 ranked players to count.
export function scoreBallots(entries: Entry[], order: string[]): { voter: string; miss: number }[] {
  const actual = new Map(order.map((id, i) => [id, i + 1]))
  return entries
    .map((e) => {
      const spots = spotsOn(e.picks.ranking ?? [], order)
      const misses = [...spots].map(([id, spot]) => Math.abs(spot - actual.get(id)!))
      return { voter: e.voter, n: misses.length, miss: misses.reduce((a, b) => a + b, 0) / (misses.length || 1) }
    })
    .filter((r) => r.n >= 3)
    .map(({ voter, miss }) => ({ voter, miss }))
    .sort((a, b) => a.miss - b.miss)
}

// The players the group got most wrong: their average ballot spot against where they actually finished. A positive
// gap means the group ranked them too high (overrated).
export function biggestMisses(entries: Entry[], order: string[]): { overrated?: { id: string; gap: number }; underrated?: { id: string; gap: number } } {
  const actual = new Map(order.map((id, i) => [id, i + 1]))
  const sums = new Map<string, { sum: number; n: number }>()
  for (const e of entries) {
    for (const [id, spot] of spotsOn(e.picks.ranking ?? [], order)) {
      const r = sums.get(id) ?? { sum: 0, n: 0 }
      r.sum += spot
      r.n++
      sums.set(id, r)
    }
  }
  const gaps = [...sums].map(([id, r]) => ({ id, gap: actual.get(id)! - r.sum / r.n }))
  const over = gaps.filter((g) => g.gap > 0).sort((a, b) => b.gap - a.gap)[0]
  const under = gaps.filter((g) => g.gap < 0).sort((a, b) => a.gap - b.gap)[0]
  return { overrated: over, underrated: under ? { id: under.id, gap: -under.gap } : undefined }
}

// Points for each entry: an award called right is worth 2, a top three spot exactly right 3, and a top three pick in the
// wrong spot 1. Best first.
export function scorePredictions(entries: Entry[], actual: Actual): { voter: string; points: number }[] {
  return entries
    .map((e) => {
      let points = 0
      for (const { key } of AWARD_PICKS) if (e.picks[key] && e.picks[key] === actual[key]) points += AWARD_POINTS
      if (e.picks.duo && e.picks.duo === actual.duo) points += AWARD_POINTS
      ;(e.picks.top3 ?? []).forEach((id, i) => {
        if (actual.top3[i] === id) points += EXACT_POINTS
        else if (actual.top3.includes(id)) points += TOP3_POINTS
      })
      return { voter: e.voter, points }
    })
    .sort((a, b) => b.points - a.points)
}
