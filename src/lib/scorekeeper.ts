import { getClient } from "./cloud"

// Anyone watching a live game can keep score: they add baskets to it through the `live-score` function,
// which only ever adds a basket for a player in the live game or undoes the last one added this way.

type Reply = { ok: true } | { ok: false; error: string }

async function call(body: Record<string, unknown>): Promise<Reply> {
  const client = getClient()
  if (!client) return { ok: false, error: "Scorekeeping needs the shared-data cloud." }
  const { error } = await client.functions.invoke("live-score", { body })
  if (!error) return { ok: true }
  const res = (error as { context?: Response }).context
  if (res && typeof res.json === "function") {
    try {
      const j = (await res.json()) as { error?: string }
      if (j.error) return { ok: false, error: j.error }
    } catch {
      /* not json */
    }
    if (res.status === 404) return { ok: false, error: "Scorekeeping is not set up yet. The league editor needs to add it." }
  }
  return { ok: false, error: "Could not reach the scoreboard. Check your connection and try again." }
}

export const sendBasket = (gameId: string, pid: string, points: number): Promise<Reply> => call({ action: "add", gameId, pid, points })
export const undoBasket = (gameId: string): Promise<Reply> => call({ action: "undo", gameId })
