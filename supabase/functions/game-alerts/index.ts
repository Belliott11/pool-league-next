// Game alerts: sends a notification to every phone that turned them on when a game goes live and when it ends.
//   POST (no body)  check the league data and send whatever is due. Called by the league_state trigger (supabase/alerts.sql) when the
//                   set of live games changes. Reads the league data itself and sends each game's "live" and "final" once, so a stray
//                   call can only send what is true and not yet sent. "Game on" waits a minute (LIVE_DELAY_MS) and is sent only if
//                   the game is still live and not marked as a test by then, so a game started by mistake can be discarded first.
//                   Test games (game.test) never send anything.
//   GET ?key=1      the site's public signing key, which a phone needs to turn alerts on.
//   POST {hello}    a "you're set" notification to a phone that just turned alerts on (once per phone, and only a saved one).
// The signing key is made here on first use and kept in push_vapid, which only this function can read.
// In Supabase: Verify JWT is off (the trigger and visitors are not signed in). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from Supabase.
import { createClient } from "npm:@supabase/supabase-js@2"
import { b64u, send, type Subscription, type Vapid } from "./webpush.ts"

const SITE = "https://intel.poolean.net/"
const FINAL_WITHIN_MS = 3 * 3600 * 1000 // a game that ended longer ago than this is not news
const LIVE_DELAY_MS = 60 * 1000 // how long "Game on" waits, so a mistaken or test start can be undone first
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

type Score = { pid: string; points: number }
type Game = { test?: boolean; id: string; date: string; teamA: string[]; teamB: string[]; liveInProgress?: boolean; winner?: string | null; endedAt?: string; liveScores?: Score[]; scorekeeperScores?: Score[] }
type State = { games: Game[]; players: { id: string; name: string }[] }

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

async function vapid(): Promise<Vapid> {
  const { data } = await db.from("push_vapid").select("d, x, y").eq("id", 1).maybeSingle()
  if (data) return { ...data, subject: SITE }
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey)
  // If two calls race, the first key stored wins and both use it.
  await db.from("push_vapid").upsert({ id: 1, d: jwk.d, x: jwk.x, y: jwk.y }, { onConflict: "id", ignoreDuplicates: true })
  const { data: kept } = await db.from("push_vapid").select("d, x, y").eq("id", 1).single()
  return { ...kept!, subject: SITE }
}

const publicKey = (v: Vapid) => {
  const un = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
  return b64u(new Uint8Array([4, ...un(v.x), ...un(v.y)]))
}

function alertsDue(state: State): { id: string; kind: "live" | "final"; title: string; body: string; url: string }[] {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const names = (ids: string[]) => ids.map(name).join(", ")
  const score = (g: Game, team: string[]) => [...(g.liveScores ?? []), ...(g.scorekeeperScores ?? [])].filter((s) => team.includes(s.pid)).reduce((n, s) => n + s.points, 0)
  const out: { id: string; kind: "live" | "final"; title: string; body: string; url: string }[] = []
  for (const g of state.games ?? []) {
    if (g.test) continue
    if (g.liveInProgress) out.push({ id: g.id, kind: "live", title: "Game on", body: `${names(g.teamA)} vs ${names(g.teamB)}. Tap to watch and vote.`, url: `${SITE}#/games/live` })
    else if ((g.winner === "A" || g.winner === "B") && g.endedAt && Date.now() - Date.parse(g.endedAt) < FINAL_WITHIN_MS) {
      const [w, l] = g.winner === "A" ? [g.teamA, g.teamB] : [g.teamB, g.teamA]
      out.push({ id: g.id, kind: "final", title: `Final: ${score(g, w)} to ${score(g, l)}`, body: `${names(w)} beat ${names(l)}.`, url: `${SITE}#/games/game/${encodeURIComponent(g.id)}` })
    }
  }
  return out
}

// Sends every alert of this kind that is due and not sent yet; returns how many phones got one.
async function sendDue(kind: "live" | "final"): Promise<number> {
  const { data: row, error } = await db.from("league_state").select("data").eq("id", 1).single()
  if (error || !row) return 0
  const due = alertsDue(row.data as State).filter((a) => a.kind === kind)
  if (!due.length) return 0
  const v = await vapid()
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth")
  let sent = 0
  for (const a of due) {
    // Claim the alert first, so it goes out once even if two calls arrive together.
    const { data: claimed } = await db.from("push_sent").upsert({ game_id: a.id, kind: a.kind }, { onConflict: "game_id,kind", ignoreDuplicates: true }).select()
    if (!claimed?.length) continue
    const payload = JSON.stringify({ title: a.title, body: a.body, url: a.url, tag: `${a.id}-${a.kind}` })
    for (const s of (subs ?? []) as Subscription[]) {
      try {
        const status = await send(s, payload, v)
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint)
        else if (status < 300) sent++
      } catch {
        // One phone's push service being down does not stop the rest.
      }
    }
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })
  try {
    if (req.method === "GET") return json({ publicKey: publicKey(await vapid()) })
    const body = (await req.json().catch(() => ({}))) as { hello?: string }
    if (typeof body.hello === "string") {
      const { data: rows } = await db.from("push_subscriptions").update({ hello_at: new Date().toISOString() }).eq("endpoint", body.hello).is("hello_at", null).select("endpoint, p256dh, auth")
      if (!rows?.length) return json({ hello: false })
      const status = await send(rows[0] as Subscription, JSON.stringify({ title: "You're set", body: "Poolean Intel will let you know when a game goes live and when it ends.", url: SITE, tag: "hello" }), await vapid())
      return json({ hello: status < 300, status })
    }
    // Finals go at once; "Game on" waits a minute and is checked again then.
    const sent = await sendDue("final")
    const wait = (async () => {
      await new Promise((r) => setTimeout(r, LIVE_DELAY_MS))
      await sendDue("live")
    })()
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime
    if (runtime) runtime.waitUntil(wait)
    else await wait
    return json({ sent, liveCheckIn: LIVE_DELAY_MS / 1000 })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
