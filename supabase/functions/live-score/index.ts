// Lets anyone watching keep score of the live game, with no sign-in and no code.
// It can do exactly two things to the live game and nothing else: add a basket for one of its players,
// and undo the last basket a scorekeeper added. It cannot start, finish, edit or delete anything.
// Their baskets go in their own list on the game (scorekeeperScores), separate from the editor's, so the
// editor's app and this function can both write during a game without overwriting each other's baskets.
//
// In Supabase: Edge Functions > live-score > turn OFF "Verify JWT" (visitors are not signed in).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself.
// It only ever acts on the game that is currently live, so with no live game it does nothing.
import { createClient } from "npm:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

const MAX_SCORES = 400

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "Use POST." }, 405)

  let body: { action?: string; gameId?: string; pid?: string; points?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Bad request." }, 400)
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  // Read, change the live game's scores only, and write back only if nobody else wrote in between.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error } = await db.from("league_state").select("data,updated_at").eq("id", 1).maybeSingle()
    if (error || !row) return json({ error: "Could not read the league data." }, 500)
    const state = row.data as { games: { id: string; liveInProgress?: boolean; teamA: string[]; teamB: string[]; scorekeeperScores?: { pid: string; points: number }[] }[] }
    const game = state.games.find((g) => g.id === body.gameId)
    if (!game || !game.liveInProgress) return json({ error: "That game is not live any more." }, 409)

    const scores = [...(game.scorekeeperScores ?? [])]
    if (body.action === "add") {
      const pid = String(body.pid ?? "")
      const points = Number(body.points)
      if (![...game.teamA, ...game.teamB].includes(pid)) return json({ error: "That player is not in this game." }, 400)
      if (![1, 2, 3].includes(points)) return json({ error: "A basket is worth 1, 2 or 3." }, 400)
      if (scores.length >= MAX_SCORES) return json({ error: "That is a lot of baskets for one game." }, 400)
      scores.push({ pid, points })
    } else if (body.action === "undo") {
      if (scores.length === 0) return json({ error: "There is no scorekeeper basket to undo." }, 409)
      scores.pop()
    } else {
      return json({ error: "Unknown action." }, 400)
    }

    game.scorekeeperScores = scores
    const now = new Date().toISOString()
    const { data: written, error: werr } = await db
      .from("league_state")
      .update({ data: state, updated_at: now })
      .eq("id", 1)
      .eq("updated_at", row.updated_at)
      .select("updated_at")
    if (werr) return json({ error: "Could not save the basket." }, 500)
    if (written && written.length > 0) return json({ ok: true })
    // Someone else saved first (the editor, or another scorekeeper): try again on the fresh copy.
  }
  return json({ error: "The game was busy. Try that basket again." }, 409)
})
