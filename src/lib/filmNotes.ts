import type { SupabaseClient } from "@supabase/supabase-js"
import { deviceKey } from "@/lib/deviceKey"

// Notes on film room plays (supabase/filmNotes.sql): short, shown to everyone under the play, each owned by the phone that wrote it
// (only that phone can delete it). Never part of the league data.
export interface FilmNote {
  id: number
  gameId: string
  eventId: string
  note: string
  author: string | null
  owner: string
  at: string
}

export const noteKey = (gameId: string, eventId: string) => `${gameId}|${eventId}`

export async function loadNotes(client: SupabaseClient): Promise<FilmNote[]> {
  const { data, error } = await client.from("film_notes").select("id,game_id,event_id,note,author,owner_hash,created_at").order("created_at")
  if (error || !data) return []
  return data.map((r) => ({ id: Number(r.id), gameId: String(r.game_id), eventId: String(r.event_id), note: String(r.note), author: r.author ? String(r.author) : null, owner: String(r.owner_hash), at: String(r.created_at) }))
}

export async function addNote(client: SupabaseClient, gameId: string, eventId: string, note: string, author: string | null): Promise<boolean> {
  const { data, error } = await client.rpc("add_film_note", { p_game_id: gameId, p_event_id: eventId, p_note: note, p_author: author ?? "", p_key: deviceKey() })
  return !error && data === true
}

export async function deleteNote(client: SupabaseClient, id: number): Promise<boolean> {
  const { data, error } = await client.rpc("delete_film_note", { p_id: id, p_key: deviceKey() })
  return !error && data === true
}
