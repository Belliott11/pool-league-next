import type { SupabaseClient } from "@supabase/supabase-js"
import { awardRace } from "@/lib/awardRace"
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

export async function savePrediction(client: SupabaseClient, season: string, voter: string, picks: Picks): Promise<boolean> {
  const { error } = await client.from("season_predictions").upsert({ season, voter, picks, updated_at: new Date().toISOString() }, { onConflict: "season,voter" })
  return !error
}

export const duoKey = (a: string, b: string) => [a, b].sort().join("|")

export interface Actual {
  mvp?: string
  dpoy?: string
  mip?: string
  duo?: string
  top3: string[]
}

// Who leads right now in the season that started on opening night.
export function actualResults(state: PooleanState, from: string): Actual {
  const season = { ...state, games: state.games.filter((g) => g.date >= from), currentSeasonStartedAt: from }
  const rows = awardRace(season)
  const lead = (key: string) => rows.find((r) => r.key === key)?.leaders[0]?.ids
  const duo = lead("best-duo")
  const top3 = computeLeaderboard(season)
    .filter((r) => r.gp >= 3)
    .sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
    .slice(0, 3)
    .map((r) => r.player.id)
  return { mvp: lead("mvp")?.[0], dpoy: lead("dpoy")?.[0], mip: lead("mip")?.[0], duo: duo && duo.length === 2 ? duoKey(duo[0], duo[1]) : undefined, top3 }
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
