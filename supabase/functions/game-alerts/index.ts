// Game alerts: sends a notification to every phone that turned them on when a game goes live and when it ends.
//   POST (no body)  check the league data and send whatever is due. Called by the league_state trigger (supabase/alerts.sql) when the
//                   set of live games changes. Reads the league data itself and sends each game's "live" and "final" once, so a stray
//                   call can only send what is true and not yet sent. "Game on" waits a minute (LIVE_DELAY_MS) and is sent only if
//                   the game is still live and not marked as a test by then, so a game started by mistake can be discarded first.
//                   Test games (game.test) never send anything.
//                   A "Final" also names up to two milestones reached in that game (milestones.ts, a copy of the site's own, with the
//                   old site's results in old-results.json from scripts/old-results.mjs).
//   POST {close}    called by the trigger when a live game's baskets change: sends one "close game" alert per game when it is tight near
//                   the end (the leader within CLOSE_GAP of the other team and within CLOSE_LEFT of the target). Never for a test game.
//   POST {reminder} sends "Game night tomorrow" once per night when tomorrow (league time) is opening night or a night the editor set up
//                   (state.rsvps). Called once a day by .github/workflows/night-reminder.yml. {reminder, dry: true, on: "YYYY-MM-DD"}
//                   only says what would go out for that night, sending and recording nothing.
//   GET ?key=1      the site's public signing key, which a phone needs to turn alerts on.
//   POST {hello}    a "you're set" notification to a phone that just turned alerts on (once per phone, and only a saved one).
// The signing key is made here on first use and kept in push_vapid, which only this function can read.
// In Supabase: Verify JWT is off (the trigger and visitors are not signed in). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from Supabase.
import { createClient } from "npm:@supabase/supabase-js@2"
import { b64u, send, type Subscription, type Vapid } from "./webpush.ts"
import { milestoneBook, reachedIn, type MGame, type OldResult } from "./milestones.ts"
import oldResults from "./old-results.json" with { type: "json" }

const SITE = "https://intel.poolean.net/"
const FINAL_WITHIN_MS = 3 * 3600 * 1000 // a game that ended longer ago than this is not news
const CLOSE_GAP = 2 // points between the teams for a "close game" alert
const CLOSE_LEFT = 2 // and the leader at most this far from the target
const LIVE_DELAY_MS = 60 * 1000 // how long "Game on" waits, so a mistaken or test start can be undone first
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

type Score = { pid: string; points: number }
type Game = { test?: boolean; id: string; date: string; teamA: string[]; teamB: string[]; liveInProgress?: boolean; winner?: string | null; endedAt?: string; liveScores?: Score[]; scorekeeperScores?: Score[]; liveTarget?: number }
type State = { games: Game[]; players: { id: string; name: string }[]; openingNight?: { date: string; time?: string } | null; rsvps?: { date: string; time?: string; playerIds?: string[] }[] }

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

type Kind = "live" | "final" | "close" | "reminder"
type Alert = { id: string; kind: Kind; title: string; body: string; url: string }

// A day in the league's own time zone (Cherry Hill), as YYYY-MM-DD.
const leagueDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/New_York" })

// "Game night tomorrow" for the night on `day`, if one is set: opening night or a night the editor set up.
function reminderFor(state: State, day: string): Alert | null {
  const opening = state.openingNight?.date === day ? state.openingNight : null
  const night = opening ?? (state.rsvps ?? []).find((r) => r.date === day)
  if (!night) return null
  const t = night.time && /^\d\d:\d\d$/.test(night.time) ? (() => { const [h, m] = night.time!.split(":").map(Number); return ` at ${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}` })() : ""
  const coming = opening ? 0 : ((night as { playerIds?: string[] }).playerIds ?? []).length
  return {
    id: `night-${day}`,
    kind: "reminder",
    title: opening ? `Opening night is tomorrow${t}` : `Game night tomorrow${t}`,
    body: `${coming ? `${coming} in so far. ` : ""}Tap to say if you're in and see who's coming.`,
    url: SITE,
  }
}

function alertsDue(state: State): Alert[] {
  const name = (id: string) => state.players.find((p) => p.id === id)?.name ?? id
  const names = (ids: string[]) => ids.map(name).join(", ")
  const score = (g: Game, team: string[]) => [...(g.liveScores ?? []), ...(g.scorekeeperScores ?? [])].filter((s) => team.includes(s.pid)).reduce((n, s) => n + s.points, 0)
  const out: Alert[] = []
  let book: ReturnType<typeof milestoneBook> | null = null
  const reached = (gameId: string) => {
    book ??= milestoneBook(state.games as unknown as MGame[], oldResults as OldResult[])
    return reachedIn(book, gameId)
      .slice(0, 2)
      .map((m) => ` ${name(m.pid)}: ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}.`)
      .join("")
  }
  for (const g of state.games ?? []) {
    if (g.test) continue
    if (g.liveInProgress) {
      out.push({ id: g.id, kind: "live", title: "Game on", body: `${names(g.teamA)} vs ${names(g.teamB)}. Tap to watch and vote.`, url: `${SITE}#/games/live` })
      const a = score(g, g.teamA)
      const b = score(g, g.teamB)
      const t = g.liveTarget
      if (t && Math.max(a, b) >= t - CLOSE_LEFT && Math.abs(a - b) <= CLOSE_GAP && Math.max(a, b) < t + 10) {
        const [hi, lo, lead, trail] = a >= b ? [a, b, g.teamA, g.teamB] : [b, a, g.teamB, g.teamA]
        out.push({
          id: g.id,
          kind: "close",
          title: hi === lo ? `Tied at ${hi}, game to ${t}` : `${hi} to ${lo}, game to ${t}`,
          body: hi === lo ? `${names(g.teamA)} and ${names(g.teamB)}, all square. Tap to watch.` : `${names(lead)} lead ${names(trail)}. Tap to watch.`,
          url: `${SITE}#/games/live`,
        })
      }
    } else if ((g.winner === "A" || g.winner === "B") && g.endedAt && Date.now() - Date.parse(g.endedAt) < FINAL_WITHIN_MS) {
      const [w, l] = g.winner === "A" ? [g.teamA, g.teamB] : [g.teamB, g.teamA]
      out.push({ id: g.id, kind: "final", title: `Final: ${score(g, w)} to ${score(g, l)}`, body: `${names(w)} beat ${names(l)}.${reached(g.id)}`, url: `${SITE}#/games/game/${encodeURIComponent(g.id)}` })
    }
  }
  return out
}

async function leagueState(): Promise<State | null> {
  const { data: row, error } = await db.from("league_state").select("data").eq("id", 1).single()
  return error || !row ? null : (row.data as State)
}

// Sends every alert of this kind that is due and not sent yet; returns how many phones got one.
async function sendDue(kind: Kind): Promise<number> {
  const state = await leagueState()
  if (!state) return 0
  return await sendAlerts(alertsDue(state).filter((a) => a.kind === kind))
}

// Sends each alert to every phone, once: an alert already recorded in push_sent is skipped.
async function sendAlerts(due: Alert[]): Promise<number> {
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
    const body = (await req.json().catch(() => ({}))) as { hello?: string; close?: boolean; reminder?: boolean; dry?: boolean; on?: string }
    if (body.reminder) {
      const state = await leagueState()
      if (!state) return json({ sent: 0 })
      const day = typeof body.on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.on) ? body.on : leagueDay(new Date(Date.now() + 24 * 3600 * 1000))
      const a = reminderFor(state, day)
      if (body.dry) return json({ day, would: a })
      // Only ever for tomorrow: "on" is for dry runs.
      if (body.on) return json({ error: "on is only for dry runs" }, 400)
      return json({ day, sent: a ? await sendAlerts([a]) : 0 })
    }
    if (typeof body.hello === "string") {
      const { data: rows } = await db.from("push_subscriptions").update({ hello_at: new Date().toISOString() }).eq("endpoint", body.hello).is("hello_at", null).select("endpoint, p256dh, auth")
      if (!rows?.length) return json({ hello: false })
      const status = await send(rows[0] as Subscription, JSON.stringify({ title: "You're set", body: "Poolean Intel will let you know when a game goes live, when one gets close at the end, and when it ends.", url: SITE, tag: "hello" }), await vapid())
      return json({ hello: status < 300, status })
    }
    if (body.close) return json({ sent: await sendDue("close") })
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
