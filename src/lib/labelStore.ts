import type { SupabaseClient } from "@supabase/supabase-js"

// Where player labels are kept. They are private: with the shared-data cloud they live in an editors-only table
// (supabase/labels.sql), and without it only in this browser. They are never part of the league data that visitors
// can read.
export type LabelBook = Record<string, string[]>

const KEY = "pooleanIntelLabels"

function readLocal(): LabelBook {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as LabelBook
  } catch {
    return {}
  }
}

export async function loadLabels(client: SupabaseClient | null): Promise<LabelBook> {
  const local = readLocal()
  if (!client) return local
  const { data, error } = await client.from("private_labels").select("data").eq("id", 1).maybeSingle()
  // A missing table or no row yet falls back to what this device has.
  if (error || !data) return local
  return { ...local, ...(data.data as LabelBook) }
}

export async function saveLabels(client: SupabaseClient | null, book: LabelBook): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(book))
  } catch {
    /* private mode: the cloud copy still saves */
  }
  if (!client) return
  await client.from("private_labels").upsert({ id: 1, data: book, updated_at: new Date().toISOString() })
}
