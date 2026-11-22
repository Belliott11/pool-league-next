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

// A vote belongs to the phone that cast it: this device's private key goes with every vote, and the database keeps only its hash
// (supabase/pickem.sql), so a vote can only be changed from the phone that made it. Without storage (private mode) a key lasts the visit.
const KEY = "pooleanIntelVoteKey"
let sessionKey = ""
function deviceKey(): string {
  try {
    const have = localStorage.getItem(KEY)
    if (have) return have
  } catch {
    /* storage blocked */
  }
  const key = sessionKey || Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("")
  sessionKey = key
  try {
    localStorage.setItem(KEY, key)
  } catch {
    /* kept for this visit only */
  }
  return key
}

// False when the vote could not be saved, including a vote another phone already made for this person.
export async function castVote(client: SupabaseClient, gameId: string, voter: string, pick: Side): Promise<boolean> {
  const { data, error } = await client.rpc("cast_pickem_vote", { p_game_id: gameId, p_voter: voter, p_pick: pick, p_key: deviceKey() })
  return !error && data === true
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
