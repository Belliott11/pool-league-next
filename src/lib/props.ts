import type { SupabaseClient } from "@supabase/supabase-js"
import { deviceKey } from "@/lib/deviceKey"
import { liveTargetOf } from "@/lib/live"
import { playerLine } from "@/lib/nightRecap"
import { winnerOf } from "@/lib/scorecard"
import type { Game, PooleanState } from "@/lib/types"

// Prop picks: over or under on a player's points in a live game, picked before its first basket (the same window as Pick'em's live vote).
// Picks live in their own table (supabase/props.sql), phone-owned like Pick'em, and the database refuses a pick once the game has a
// basket, on a test game, or on yourself.
//
// A line is the player's points per point of target over the games before this one, leaned on the league's rate by PRIOR_GAMES games,
// times this game's target, rounded down to a half (so there is no push). It comes only from the league data, so the standings score every
// pick against the line worked out again from the data, whatever line a phone sent.

export const PRIOR_GAMES = 3

export type PropSide = "over" | "under"

export interface PropPick {
  gameId: string
  pid: string
  voter: string
  pick: PropSide
}

const done = (g: Game) => !g.test && !g.liveInProgress && !!winnerOf(g)

// Every line for one game, keyed by player.
export function linesFor(state: PooleanState, game: Game): Map<string, number> {
  const at = state.games.findIndex((g) => g.id === game.id)
  const before = state.games.filter((g, i) => done(g) && (g.date < game.date || (g.date === game.date && i < at)))
  const rates = new Map<string, { pts: number; per: number }>()
  let leaguePts = 0
  let leaguePer = 0
  for (const g of before) {
    const per = liveTargetOf(g)
    for (const pid of [...g.teamA, ...g.teamB]) {
      const pts = playerLine(g, pid).pts
      const r = rates.get(pid) ?? { pts: 0, per: 0 }
      r.pts += pts
      r.per += per
      rates.set(pid, r)
      leaguePts += pts
      leaguePer += per
    }
  }
  const league = leaguePer ? leaguePts / leaguePer : 0.25
  const target = liveTargetOf(game)
  const out = new Map<string, number>()
  for (const pid of [...game.teamA, ...game.teamB]) {
    const r = rates.get(pid) ?? { pts: 0, per: 0 }
    const rate = (r.pts + league * PRIOR_GAMES * target) / (r.per + PRIOR_GAMES * target)
    out.set(pid, Math.max(0.5, Math.floor(rate * target) + 0.5))
  }
  return out
}

export async function loadProps(client: SupabaseClient, gameId?: string): Promise<PropPick[]> {
  let q = client.from("prop_picks").select("game_id,pid,voter,pick")
  if (gameId) q = q.eq("game_id", gameId)
  const { data, error } = await q
  if (error || !data) return []
  return data.map((r) => ({ gameId: String(r.game_id), pid: String(r.pid), voter: String(r.voter), pick: r.pick === "under" ? "under" : "over" }))
}

export async function castProp(client: SupabaseClient, gameId: string, pid: string, voter: string, pick: PropSide, line: number): Promise<boolean> {
  const { data, error } = await client.rpc("cast_prop_pick", { p_game_id: gameId, p_pid: pid, p_voter: voter, p_pick: pick, p_line: line, p_key: deviceKey() })
  return !error && data === true
}

export interface PropRow {
  voter: string
  right: number
  total: number
}

// Everyone's record on finished games, scored against each line worked out from the league data.
export function propStandings(state: PooleanState, picks: PropPick[]): PropRow[] {
  const byGame = new Map(state.games.map((g) => [g.id, g]))
  const lines = new Map<string, Map<string, number>>()
  const rows = new Map<string, PropRow>()
  for (const p of picks) {
    const g = byGame.get(p.gameId)
    if (!g || !done(g) || p.voter === p.pid) continue
    const gl = lines.get(g.id) ?? lines.set(g.id, linesFor(state, g)).get(g.id)!
    const line = gl.get(p.pid)
    if (line === undefined) continue
    const over = playerLine(g, p.pid).pts > line
    const r = rows.get(p.voter) ?? { voter: p.voter, right: 0, total: 0 }
    r.total++
    if (over === (p.pick === "over")) r.right++
    rows.set(p.voter, r)
  }
  return [...rows.values()].sort((a, b) => b.right - a.right || b.right / b.total - a.right / a.total || b.total - a.total)
}
