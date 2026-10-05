import { getClient } from "./cloud"

// Anyone watching can run a live game through the `live-score` function: start one (from existing players,
// when none is live), add baskets, undo the last one added this way, and finish it. Nothing else.

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
export const startGame = (gameId: string, date: string, teamA: string[], teamB: string[], target: number): Promise<Reply> =>
  call({ action: "start", gameId, date, teamA, teamB, target })
export const finishGame = (gameId: string): Promise<Reply> => call({ action: "finish", gameId })
export const undoBasket = (gameId: string): Promise<Reply> => call({ action: "undo", gameId })
