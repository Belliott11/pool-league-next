// Lets anyone watching run a live game, with no sign-in and no code. It can do four things and nothing else:
//   start  a live game from players that already exist (only when no game is live)
//   add    a basket for one of the live game's players
//   undo   the last basket added this way
//   finish the live game (their baskets count toward the final score)
// It cannot add or remove players, edit or delete past games, or touch anything else.
// Baskets added here go in their own list on the game (scorekeeperScores), separate from the editor's, so
// the editor's app and this function can both write during a game without overwriting each other.
//
// In Supabase: Edge Functions > live-score > turn OFF "Verify JWT" (visitors are not signed in).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
import { createClient } from "npm:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

const MAX_SCORES = 400

type Score = { pid: string; points: number; bid?: string }
type Game = {
  id: string
  date: string
  liveInProgress?: boolean
  liveTarget?: number
  prediction?: { pA: number; at: string }
  liveScores?: Score[]
  scorekeeperScores?: Score[]
  winner?: "A" | "B" | null
  teamA: string[]
  teamB: string[]
  [key: string]: unknown
}
type State = { players: { id: string }[]; games: Game[]; [key: string]: unknown }
type Body = { action?: string; gameId?: string; pid?: string; points?: number; bid?: string; pA?: number; teamA?: string[]; teamB?: string[]; target?: number; date?: string }

const total = (g: Game, team: string[]) => [...(g.liveScores ?? []), ...(g.scorekeeperScores ?? [])].filter((s) => team.includes(s.pid)).reduce((sum, s) => sum + s.points, 0)
const ids = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])

// Applies one change to a copy of the state, or returns an error to send back.
function apply(state: State, body: Body): { error: string; status: number } | null {
  if (body.action === "start") {
    if (state.games.some((g) => g.liveInProgress)) return { error: "A game is already live.", status: 409 }
    const teamA = ids(body.teamA)
    const teamB = ids(body.teamB)
    const known = new Set(state.players.map((p) => p.id))
    if (teamA.length === 0 || teamB.length === 0) return { error: "Put at least one player on each team.", status: 400 }
    if (![...teamA, ...teamB].every((id) => known.has(id))) return { error: "Unknown player.", status: 400 }
    if (new Set([...teamA, ...teamB]).size !== teamA.length + teamB.length) return { error: "A player can only be on one team.", status: 400 }
    const target = Math.round(Number(body.target))
    if (!(target >= 1 && target <= 99)) return { error: "Pick a target between 1 and 99.", status: 400 }
    const id = String(body.gameId ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)
    if (!id || state.games.some((g) => g.id === id)) return { error: "Bad game id.", status: 400 }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? "")) ? String(body.date) : new Date().toISOString().slice(0, 10)
    state.games.push({
      id,
      date,
      videoUrl: "",
      notes: "",
      winner: null,
      teamA,
      teamB,
      stats: [],
      matchups: [],
      scoringEvents: [],
      turnoverEvents: [],
      stealEvents: [],
      foulEvents: [],
      plays: [],
      liveInProgress: true,
      liveScores: [],
      liveTarget: target,
      // The model's call, sent by the phone that started the game before anything was played.
      ...(Number(body.pA) > 0 && Number(body.pA) < 1 ? { prediction: { pA: Math.round(Number(body.pA) * 1000) / 1000, at: new Date().toISOString() } } : {}),
    })
    return null
  }

  const game = state.games.find((g) => g.id === body.gameId)
  if (!game || !game.liveInProgress) return { error: "That game is not live any more.", status: 409 }
  const scores = [...(game.scorekeeperScores ?? [])]

  if (body.action === "add") {
    const pid = String(body.pid ?? "")
    const points = Number(body.points)
    if (![...game.teamA, ...game.teamB].includes(pid)) return { error: "That player is not in this game.", status: 400 }
    if (![1, 2, 3].includes(points)) return { error: "A basket is worth 1, 2 or 3.", status: 400 }
    if (scores.length >= MAX_SCORES) return { error: "That is a lot of baskets for one game.", status: 400 }
    // A phone that lost signal sends the same basket again; the id makes that harmless.
    const bid = String(body.bid ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)
    if (bid && scores.some((x) => x.bid === bid)) return null
    scores.push(bid ? { pid, points, bid } : { pid, points })
    game.scorekeeperScores = scores
    return null
  }
  if (body.action === "undo") {
    if (scores.length === 0) return { error: "There is no basket added this way to undo.", status: 409 }
    scores.pop()
    game.scorekeeperScores = scores
    return null
  }
  if (body.action === "finish") {
    const a = total(game, game.teamA)
    const b = total(game, game.teamB)
    if (a === 0 && b === 0) return { error: "Nobody has scored yet. There is nothing to finish.", status: 409 }
    game.liveScores = [...(game.liveScores ?? []), ...scores]
    delete game.scorekeeperScores
    delete game.liveInProgress
    game.winner = a > b ? "A" : b > a ? "B" : null
    return null
  }
  return { error: "Unknown action.", status: 400 }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "Use POST." }, 405)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: "Bad request." }, 400)
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  // Read, change, and write back only if nobody else wrote in between; otherwise try again on the fresh copy.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error } = await db.from("league_state").select("data,updated_at").eq("id", 1).maybeSingle()
    if (error || !row) return json({ error: "Could not read the league data." }, 500)
    const state = row.data as State
    const problem = apply(state, body)
    if (problem) return json({ error: problem.error }, problem.status)

    const { data: written, error: werr } = await db
      .from("league_state")
      .update({ data: state, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .eq("updated_at", row.updated_at)
      .select("updated_at")
    if (werr) return json({ error: "Could not save that." }, 500)
    if (written && written.length > 0) return json({ ok: true })
  }
  return json({ error: "The game was busy. Try that again.", }, 409)
})
