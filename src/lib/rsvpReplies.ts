import type { SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useState } from "react"
import { getClient } from "@/lib/cloud"
import { deviceKey } from "@/lib/deviceKey"

// "I'm in" and "Can't make it", answered by each player from their own phone. Replies live in their own table (supabase/rsvp.sql),
// apart from the league data, so answering never needs the editor. A reply belongs to the phone that made it.
export interface Reply {
  player: string
  going: boolean
}

export async function loadReplies(client: SupabaseClient, night: string): Promise<Reply[]> {
  const { data, error } = await client.from("rsvp_replies").select("player,going").eq("night", night)
  if (error || !data) return []
  return data.map((r) => ({ player: String(r.player), going: r.going === true }))
}

// False when the reply could not be saved, including one another phone already made for this person.
export async function saveReply(client: SupabaseClient, night: string, player: string, going: boolean): Promise<boolean> {
  const { data, error } = await client.rpc("save_rsvp", { p_night: night, p_player: player, p_going: going, p_key: deviceKey() })
  return !error && data === true
}

// Who is coming: the editor's list with each player's own reply on top (their word wins), in the editor's order, then the rest by when
// they appear in the replies.
export function whoIsComing(editorList: string[], replies: Reply[]): string[] {
  const said = new Map(replies.map((r) => [r.player, r.going]))
  const kept = editorList.filter((id) => said.get(id) !== false)
  const added = replies.filter((r) => r.going && !kept.includes(r.player)).map((r) => r.player)
  return [...kept, ...added]
}

// The replies for one night, kept fresh: tries every few seconds until the database client is ready, then once a minute.
export function useReplies(night: string | null): [Reply[], (r: Reply[]) => void] {
  const [replies, setReplies] = useState<Reply[]>([])
  useEffect(() => {
    if (!night) return
    let done = false
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const c = getClient()
      if (c) {
        const r = await loadReplies(c, night)
        if (!done) setReplies(r)
      }
      if (!done) timer = setTimeout(tick, c ? 60_000 : 2_000)
    }
    void tick()
    return () => {
      done = true
      clearTimeout(timer)
    }
  }, [night])
  return [replies, setReplies]
}
