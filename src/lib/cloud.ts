// Shared data in Supabase. One row holds the whole league state: anyone can read it (that is the
// public viewer link), and only accounts listed in the `admins` table can write it. See
// supabase/schema.sql and docs/cloud-setup.md. When public/cloud-config.json is empty the app skips
// all of this and works from the browser's own storage as before.
import type { SupabaseClient } from "@supabase/supabase-js"
import type { PooleanState } from "./types"

export interface CloudConfig {
  url: string
  anonKey: string
}

export interface Remote {
  state: PooleanState
  updatedAt: string
}

export type SaveResult = { ok: true; updatedAt: string } | { ok: false; conflict: boolean; message: string }

let client: SupabaseClient | null = null

// The client once connect() has run, or null when no cloud is configured.
export function getClient(): SupabaseClient | null {
  return client
}

export async function loadCloudConfig(): Promise<CloudConfig | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}cloud-config.json`, { cache: "no-store" })
    if (!res.ok) return null
    const cfg = (await res.json()) as Partial<CloudConfig>
    return cfg.url && cfg.anonKey ? { url: cfg.url, anonKey: cfg.anonKey } : null
  } catch {
    return null
  }
}

// The library is only loaded when a cloud is configured, so the offline-only build stays small.
export async function connect(cfg: CloudConfig): Promise<SupabaseClient> {
  if (client) return client
  const { createClient } = await import("@supabase/supabase-js")
  client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "pooleanIntelAuth" },
  })
  return client
}

export async function fetchRemote(c: SupabaseClient): Promise<Remote | null> {
  const { data, error } = await c.from("league_state").select("data,updated_at").eq("id", 1).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { state: data.data as PooleanState, updatedAt: data.updated_at as string } : null
}

export interface VersionInfo {
  id: number
  versionAt: string
  games: number
  players: number
}

// Past versions of the shared data (see supabase/history.sql). Editors only; returns [] when the
// history table has not been created yet.
export async function listVersions(c: SupabaseClient): Promise<VersionInfo[]> {
  const { data, error } = await c.from("league_state_history").select("id,version_at,game_count,player_count").order("id", { ascending: false }).limit(100)
  if (error) return []
  return (data ?? []).map((r) => ({ id: r.id as number, versionAt: r.version_at as string, games: r.game_count as number, players: r.player_count as number }))
}

export async function fetchVersion(c: SupabaseClient, id: number): Promise<PooleanState | null> {
  const { data, error } = await c.from("league_state_history").select("data").eq("id", id).maybeSingle()
  return error || !data ? null : (data.data as PooleanState)
}

// Keeps the data as it is right now in the history, so a restore can itself be undone.
export async function snapshotCurrent(c: SupabaseClient): Promise<boolean> {
  const remote = await fetchRemote(c)
  if (!remote) return true
  const { error } = await c.from("league_state_history").insert({
    data: remote.state,
    version_at: remote.updatedAt,
    game_count: remote.state.games.length,
    player_count: remote.state.players.length,
  })
  return !error
}

// A signed-in account is an editor only if it has a row in `admins` (each account can see its own row).
export async function isEditor(c: SupabaseClient): Promise<boolean> {
  const { data, error } = await c.from("admins").select("user_id").maybeSingle()
  return !error && !!data
}

// Writes only if the row is still the version this device last saw, so two devices cannot silently
// overwrite each other. `expected` is null when no row exists yet.
export async function saveRemote(c: SupabaseClient, state: PooleanState, expected: string | null): Promise<SaveResult> {
  const { data: s } = await c.auth.getSession()
  const uid = s.session?.user.id
  const now = new Date().toISOString()
  if (expected === null) {
    const { data, error } = await c.from("league_state").insert({ id: 1, data: state, updated_at: now, updated_by: uid }).select("updated_at")
    if (error) return { ok: false, conflict: error.code === "23505", message: error.message }
    return { ok: true, updatedAt: (data?.[0]?.updated_at as string) ?? now }
  }
  const { data, error } = await c
    .from("league_state")
    .update({ data: state, updated_at: now, updated_by: uid })
    .eq("id", 1)
    .eq("updated_at", expected)
    .select("updated_at")
  if (error) return { ok: false, conflict: false, message: error.message }
  if (!data || data.length === 0) return { ok: false, conflict: true, message: "The cloud copy changed since this device last loaded it." }
  return { ok: true, updatedAt: data[0].updated_at as string }
}
