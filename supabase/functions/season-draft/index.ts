// Season team draft room: lets each captain make their team's pick from their own phone. It can do two things and nothing else:
//   pick  put an unpicked player on the team on the clock: from that team's captain link (key checked against the hash the editor saved
//         in the set's captainKeys), or from a signed-in editor for any team
//   undo  take back the last pick (editors only)
// The order is the snake in seasonDraft.ts, a byte-for-byte copy of the site's own. Nothing else in the league data is touched.
// In Supabase: Verify JWT is off (captains are not signed in; an editor's own token is checked here). SUPABASE_URL,
// SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY come from Supabase.
import { createClient } from "npm:@supabase/supabase-js@2"
import { draftPick, onTheClock, undoPick, type DraftTeam } from "./seasonDraft.ts"

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

type Set = { id: string; drafting?: boolean; to?: string; teams: DraftTeam[]; captainKeys?: Record<string, string>; lastPickAt?: string; [k: string]: unknown }
type State = { players: { id: string }[]; seasonTeamSets?: Set[]; [k: string]: unknown }
type Body = { action?: string; setId?: string; teamId?: string; key?: string; pid?: string }

const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("")

async function isEditor(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return false
  const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await c.auth.getUser()
  if (!u?.user) return false
  const { data } = await c.from("admins").select("user_id").eq("user_id", u.user.id).maybeSingle()
  return !!data
}

function apply(state: State, body: Body, who: { editor: boolean; team: string | null }): { error: string; status: number } | null {
  const sets = state.seasonTeamSets ?? []
  const i = sets.findIndex((s) => s.id === body.setId)
  const set = sets[i]
  if (!set || !set.drafting) return { error: "That draft is over.", status: 409 }
  if (body.action === "undo") {
    if (!who.editor) return { error: "Only the editor can take a pick back.", status: 403 }
    sets[i] = { ...undoPick(set), lastPickAt: new Date().toISOString() }
    return null
  }
  if (body.action !== "pick") return { error: "Unknown action.", status: 400 }
  const clock = onTheClock(set)
  if (!clock) return { error: "Everyone has been picked.", status: 409 }
  if (!who.editor && who.team !== clock.id) return { error: "It is not your pick.", status: 409 }
  const pid = String(body.pid ?? "")
  if (!state.players.some((p) => p.id === pid)) return { error: "Unknown player.", status: 400 }
  if (set.teams.some((t) => t.members.includes(pid))) return { error: "That player has been picked.", status: 409 }
  sets[i] = { ...draftPick(set, pid), lastPickAt: new Date().toISOString() }
  return null
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
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const editor = typeof body.key === "string" && body.key ? false : await isEditor(req)
  // Read, change, and write back only if nobody else wrote in between; otherwise try again on the fresh copy.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error } = await db.from("league_state").select("data,updated_at").eq("id", 1).maybeSingle()
    if (error || !row) return json({ error: "Could not read the league data." }, 500)
    const state = row.data as State
    let team: string | null = null
    if (!editor) {
      const set = (state.seasonTeamSets ?? []).find((s) => s.id === body.setId)
      const want = set?.captainKeys?.[String(body.teamId ?? "")]
      if (!want || typeof body.key !== "string" || body.key.length < 16 || (await sha256(body.key)) !== want) return json({ error: "That captain link does not work any more. Ask the editor for a new one." }, 403)
      team = String(body.teamId)
    }
    const problem = apply(state, body, { editor, team })
    if (problem) return json({ error: problem.error }, problem.status)
    const { data: written, error: werr } = await db.from("league_state").update({ data: state, updated_at: new Date().toISOString() }).eq("id", 1).eq("updated_at", row.updated_at).select("updated_at")
    if (werr) return json({ error: "Could not save that." }, 500)
    if (written && written.length > 0) return json({ ok: true })
  }
  return json({ error: "The draft was busy. Try that again." }, 409)
})
