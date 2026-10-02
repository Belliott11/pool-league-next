import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { connect, fetchRemote, isEditor, loadCloudConfig, saveRemote, type Remote } from "./cloud"
import type { PooleanState } from "./types"

export type CloudStatus = "loading" | "off" | "ready"
export type SyncState = "idle" | "saving" | "saved" | "error" | "conflict"

const SAVE_DELAY_MS = 1500
const POLL_MS = 60_000
// While a live game is on, visitors refresh every few seconds so the score and odds follow along.
const LIVE_POLL_MS = 10_000

// Everything the app needs from the cloud: whether it is configured, who is signed in, the shared
// copy of the data, and a debounced save for editors.
export function useCloud() {
  const [status, setStatus] = useState<CloudStatus>("loading")
  const [admin, setAdmin] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [remote, setRemote] = useState<Remote | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sync, setSync] = useState<SyncState>("idle")
  const [syncMessage, setSyncMessage] = useState("")
  const clientRef = useRef<SupabaseClient | null>(null)
  const version = useRef<string | null>(null)
  const pending = useRef<PooleanState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const refresh = useCallback(async () => {
    const c = clientRef.current
    if (!c) return null
    try {
      const r = await fetchRemote(c)
      version.current = r?.updatedAt ?? null
      setRemote(r)
      setError(null)
      return r
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach the shared data.")
      return null
    } finally {
      setLoaded(true)
    }
  }, [])

  const evaluateSession = useCallback(async () => {
    const c = clientRef.current
    if (!c) return
    const { data } = await c.auth.getSession()
    const user = data.session?.user
    setEmail(user?.email ?? null)
    setAdmin(user ? await isEditor(c) : false)
  }, [])

  useEffect(() => {
    let sub: { unsubscribe: () => void } | undefined
    let dead = false
    ;(async () => {
      const cfg = await loadCloudConfig()
      if (!cfg) {
        if (!dead) setStatus("off")
        return
      }
      const c = await connect(cfg)
      clientRef.current = c
      await evaluateSession()
      await refresh()
      if (dead) return
      setStatus("ready")
      sub = c.auth.onAuthStateChange(() => void evaluateSession()).data.subscription
    })()
    return () => {
      dead = true
      sub?.unsubscribe()
    }
  }, [evaluateSession, refresh])

  const liveNow = !!remote?.state.games.some((g) => g.liveInProgress)
  // Viewers pick up the editor's changes: every minute, and whenever the tab comes back into view.
  useEffect(() => {
    if (status !== "ready" || admin) return
    const tick = () => void refresh()
    const id = setInterval(tick, liveNow ? LIVE_POLL_MS : POLL_MS)
    const onVis = () => document.visibilityState === "visible" && tick()
    document.addEventListener("visibilitychange", onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [status, admin, refresh, liveNow])

  const flush = useCallback(async () => {
    const c = clientRef.current
    const next = pending.current
    if (!c || !next) return
    pending.current = null
    const r = await saveRemote(c, next, version.current)
    if (r.ok) {
      version.current = r.updatedAt
      setSync(pending.current ? "saving" : "saved")
      setSyncMessage("")
    } else {
      pending.current ??= next
      setSync(r.conflict ? "conflict" : "error")
      setSyncMessage(r.message)
    }
  }, [])

  // Editors call this after every change; the save waits for a pause so a burst is one write.
  const push = useCallback(
    (state: PooleanState) => {
      pending.current = state
      setSync("saving")
      clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
    },
    [flush],
  )

  // Replace whatever is in the cloud with this copy (first publish, or "mine wins" after a conflict).
  const overwrite = useCallback(
    async (state: PooleanState) => {
      clearTimeout(timer.current)
      setSync("saving")
      await refresh()
      pending.current = state
      await flush()
      await refresh()
    },
    [flush, refresh],
  )

  // After a conflict: drop the unsaved local change and take what the cloud has.
  const acceptRemote = useCallback(async () => {
    clearTimeout(timer.current)
    pending.current = null
    const r = await refresh()
    setSync("idle")
    setSyncMessage("")
    return r
  }, [refresh])

  const signIn = useCallback(
    async (emailAddress: string, password: string): Promise<string | null> => {
      const c = clientRef.current
      if (!c) return "The cloud is not set up."
      const { error: err } = await c.auth.signInWithPassword({ email: emailAddress, password })
      if (err) return err.message
      await evaluateSession()
      const { data } = await c.auth.getSession()
      if (data.session && !(await isEditor(c))) {
        await c.auth.signOut()
        await evaluateSession()
        return "That account is not set up as an editor."
      }
      return null
    },
    [evaluateSession],
  )

  const signOut = useCallback(async () => {
    clearTimeout(timer.current)
    pending.current = null
    setSync("idle")
    await clientRef.current?.auth.signOut()
    await evaluateSession()
    await refresh()
  }, [evaluateSession, refresh])

  return { status, admin, email, remote, loaded, error, sync, syncMessage, refresh, push, overwrite, acceptRemote, signIn, signOut }
}

export type Cloud = ReturnType<typeof useCloud>
