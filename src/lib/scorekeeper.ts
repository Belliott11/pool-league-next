import { getClient } from "./cloud"

// Friends who keep score use a shared code (set by the editor in Supabase). It is kept on their device so
// they only type it once. The code only ever allows adding baskets to the live game and undoing them.
const KEY = "pooleanIntelScorekeeperCode"

export const getScorekeeperCode = (): string => {
  try {
    return localStorage.getItem(KEY) ?? ""
  } catch {
    return ""
  }
}

export const setScorekeeperCode = (code: string) => {
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode: the code just is not remembered */
  }
}

type Reply = { ok: true } | { ok: false; error: string }

async function call(body: Record<string, unknown>): Promise<Reply> {
  const client = getClient()
  if (!client) return { ok: false, error: "Scorekeeping needs the shared-data cloud." }
  const { error } = await client.functions.invoke("live-score", { body: { code: getScorekeeperCode(), ...body } })
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

// Checks a code before keeping it.
export async function checkScorekeeperCode(code: string): Promise<Reply> {
  const prev = getScorekeeperCode()
  setScorekeeperCode(code.trim())
  const r = await call({ action: "check" })
  if (!r.ok) setScorekeeperCode(prev)
  return r
}

export const sendBasket = (gameId: string, pid: string, points: number): Promise<Reply> => call({ action: "add", gameId, pid, points })
export const undoBasket = (gameId: string): Promise<Reply> => call({ action: "undo", gameId })
