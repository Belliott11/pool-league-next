import { getClient } from "@/lib/cloud"
import { SITE } from "@/lib/site"
import type { SeasonTeamSet } from "@/lib/types"

// The draft room: each captain picks from their own phone. The editor makes a link per captain; the link carries a random key, and the
// league data keeps only its hash (set.captainKeys), so reading the public data does not let anyone pick. Picks go through the
// season-draft edge function, which checks the key and that it is that team's turn. A new set of links replaces the old ones.

const STORE = "seasonCaptainLink"

export interface CaptainLink {
  setId: string
  teamId: string
  key: string
}

const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
export const sha256 = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("")

// A fresh link per team, and the hashes to save in the set.
export async function makeCaptainLinks(set: SeasonTeamSet): Promise<{ keys: Record<string, string>; links: { teamId: string; url: string }[] }> {
  const keys: Record<string, string> = {}
  const links: { teamId: string; url: string }[] = []
  for (const t of set.teams) {
    const key = b64u(crypto.getRandomValues(new Uint8Array(18)))
    keys[t.id] = await sha256(key)
    links.push({ teamId: t.id, url: `${SITE}#/games/teams/${encodeURIComponent(`${set.id}.${t.id}.${key}`)}` })
  }
  return { keys, links }
}

export function parseCaptainLink(arg: string): CaptainLink | null {
  const [setId, teamId, key] = arg.split(".")
  return setId && teamId && key && key.length >= 16 ? { setId, teamId, key } : null
}

export function savedCaptainLink(): CaptainLink | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? "null") as CaptainLink | null
    return v && v.setId && v.teamId && v.key ? v : null
  } catch {
    return null
  }
}

export function saveCaptainLink(link: CaptainLink | null) {
  try {
    if (link) localStorage.setItem(STORE, JSON.stringify(link))
    else localStorage.removeItem(STORE)
  } catch {
    /* private mode: the link works for this visit only */
  }
}

// Asks the league data to refresh now, so a pick shows at once instead of at the next poll (useCloud listens).
export const askRefresh = () => window.dispatchEvent(new Event("poolean:refresh"))

// A pick from a captain's link, or from the signed-in editor (the client sends the editor's own token).
export async function sendPick(setId: string, pid: string, link: CaptainLink | null): Promise<string | null> {
  return call({ action: "pick", setId, pid, ...(link ? { teamId: link.teamId, key: link.key } : {}) })
}
export const sendUndo = (setId: string) => call({ action: "undo", setId })

async function call(body: Record<string, unknown>): Promise<string | null> {
  const client = getClient()
  if (!client) return "The draft room needs the shared-data cloud."
  const { error } = await client.functions.invoke("season-draft", { body })
  if (!error) {
    askRefresh()
    return null
  }
  const res = (error as { context?: Response }).context
  if (res && typeof res.json === "function") {
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) return j.error
    } catch {
      /* not json */
    }
  }
  return "No signal. Try the pick again."
}
