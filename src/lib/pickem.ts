import type { SupabaseClient } from "@supabase/supabase-js"
import { backtestPick } from "@/lib/matchup"
import { favoriteOf, winnerOf, type Side } from "@/lib/scorecard"
import type { PooleanState } from "@/lib/types"

// Pick'em: friends call the winner of a game before it starts. Votes live in their own table (supabase/pickem.sql),
// separate from the league data, so voting never needs the editor.
export interface Vote {
  gameId: string
  voter: string // a player id
  pick: Side
}

export async function loadVotes(client: SupabaseClient): Promise<Vote[]> {
  const { data, error } = await client.from("pickem_votes").select("game_id,voter,pick")
  if (error || !data) return []
  return data.map((r) => ({ gameId: String(r.game_id), voter: String(r.voter), pick: r.pick === "B" ? "B" : "A" }))
}

export async function castVote(client: SupabaseClient, gameId: string, voter: string, pick: Side): Promise<boolean> {
  const { error } = await client.from("pickem_votes").upsert({ game_id: gameId, voter, pick, updated_at: new Date().toISOString() }, { onConflict: "game_id,voter" })
  return !error
}

// A game can be voted on until it has a score or is being played live.
export function openForVotes(state: PooleanState): PooleanState["games"] {
  return state.games.filter((g) => !g.liveInProgress && !winnerOf(g) && g.teamA.length > 0 && g.teamB.length > 0 && !(g.scoringEvents.length > 0))
}

export interface PickemRow {
  voter: string
  right: number
  total: number
}

// Everyone's record on finished games, and the model's call on those same games (its saved pick, or its backtest call).
export function pickemStandings(state: PooleanState, votes: Vote[]) {
  const byGame = new Map(state.games.map((g) => [g.id, g]))
  const rows = new Map<string, PickemRow>()
  const voted = new Set<string>()
  for (const v of votes) {
    const g = byGame.get(v.gameId)
    const winner = g && winnerOf(g)
    if (!g || !winner) continue
    voted.add(g.id)
    const r = rows.get(v.voter) ?? { voter: v.voter, right: 0, total: 0 }
    r.total++
    if (v.pick === winner) r.right++
    rows.set(v.voter, r)
  }
  const model = { right: 0, total: 0 }
  for (const id of voted) {
    const g = byGame.get(id)!
    const pA = g.prediction?.pA ?? backtestPick(g)
    const fav = g.prediction ? favoriteOf(g) : pA === undefined || pA === 0.5 ? null : pA > 0.5 ? "A" : "B"
    if (!fav) continue
    model.total++
    if (fav === winnerOf(g)) model.right++
  }
  const sorted = [...rows.values()].sort((a, b) => b.right - a.right || b.right / b.total - a.right / a.total || b.total - a.total)
  return { rows: sorted, model }
}
