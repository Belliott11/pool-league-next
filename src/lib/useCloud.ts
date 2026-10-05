import { useCallback, useEffect, useRef, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { connect, fetchRemote, isEditor, loadCloudConfig, saveRemote, type Remote } from "./cloud"
import { adoptScorekeeperScores } from "./live"
import type { PooleanState } from "./types"

export type CloudStatus = "loading" | "off" | "ready"
export type SyncState = "idle" | "saving" | "saved" | "error" | "conflict"

const SAVE_DELAY_MS = 1500
// A save that fails (no signal at the court) is retried by itself, backing off to a minute, and right away
// when the phone comes back online. Edits are always kept on the device too, so nothing is lost meanwhile.
const RETRY_START_MS = 5_000
const RETRY_MAX_MS = 60_000

const ADMIN_KEY = "pooleanIntelAdmin" // { id, email } of the editor, so the editor view still opens offline
const VERSION_KEY = "pooleanIntelCloudVersion" // the cloud version this device last saw or saved
const UNSENT_KEY = "pooleanIntelUnsent" // "1" while this device has edits the cloud has not received

const lsGet = (k: string): string | null => {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}
const lsSet = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    /* private mode: the offline extras just do not persist */
  }
}
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
  const retryMs = useRef(RETRY_START_MS)
  // True when this device had edits the cloud never received, so the editor view starts from them.
  const [recoverLocal, setRecoverLocal] = useState(false)
  // While the editor has a live game, friends may be adding baskets; the editor's app watches for them.
  const [watchLive, setWatchLive] = useState(false)
  const watchRef = useRef(false)
  watchRef.current = watchLive
  const [external, setExternal] = useState<Remote | null>(null)
  const inflight = useRef(false)
  const mergeTries = useRef(0)

  const refresh = useCallback(async () => {
    const c = clientRef.current
    if (!c) return null
    try {
      const r = await fetchRemote(c)
      version.current = r?.updatedAt ?? null
      lsSet(VERSION_KEY, version.current)
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
    const known = (() => {
      try {
        return JSON.parse(lsGet(ADMIN_KEY) ?? "null") as { id: string; email: string | null } | null
      } catch {
        return null
      }
    })()
    if (!user) {
      // Offline with an expired login the library cannot refresh: stay in the editor view the device already had.
      if (known && typeof navigator !== "undefined" && !navigator.onLine) {
        setEmail(known.email)
        setAdmin(true)
        return
      }
      setEmail(null)
      setAdmin(false)
      lsSet(ADMIN_KEY, null)
      return
    }
    setEmail(user.email ?? null)
    const editor = await isEditor(c)
    if (editor === null) setAdmin(known?.id === user.id)
    else {
      setAdmin(editor)
      lsSet(ADMIN_KEY, editor ? JSON.stringify({ id: user.id, email: user.email ?? null }) : null)
    }
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
      const cachedVersion = lsGet(VERSION_KEY)
      const unsent = lsGet(UNSENT_KEY) === "1"
      await evaluateSession()
      const first = await refresh()
      // Edits made while offline: keep them, and make the next save compare against the version they were
      // based on, so if the cloud changed meanwhile it shows as a conflict instead of overwriting.
      if (unsent) {
        setRecoverLocal(true)
        if (!first || first.updatedAt !== cachedVersion) version.current = cachedVersion
      } else if (!first && cachedVersion) version.current = cachedVersion
      if (dead) return
      setStatus("ready")
      sub = c.auth.onAuthStateChange(() => void evaluateSession()).data.subscription
    })()
    return () => {
      dead = true
      sub?.unsubscribe()
    }
  }, [evaluateSession, refresh])

  const adminPoll = useCallback(async () => {
    const c = clientRef.current
    if (!c || pending.current || inflight.current) return
    try {
      const r = await fetchRemote(c)
      if (!r || pending.current || inflight.current || r.updatedAt === version.current) return
      version.current = r.updatedAt
      lsSet(VERSION_KEY, r.updatedAt)
      setExternal(r)
    } catch {
      /* no signal: try again next time */
    }
  }, [])

  useEffect(() => {
    if (status !== "ready" || !admin || !watchLive) return
    const id = setInterval(() => void adminPoll(), 6_000)
    return () => clearInterval(id)
  }, [status, admin, watchLive, adminPoll])

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
    inflight.current = true
    const r = await saveRemote(c, next, version.current).finally(() => {
      inflight.current = false
    })
    if (r.ok) {
      mergeTries.current = 0
      version.current = r.updatedAt
      lsSet(VERSION_KEY, r.updatedAt)
      retryMs.current = RETRY_START_MS
      if (!pending.current) lsSet(UNSENT_KEY, "0")
      setSync(pending.current ? "saving" : "saved")
      setSyncMessage("")
    } else {
      // During a live game a conflict is usually a friend's basket: take their baskets and save again.
      if (r.conflict && watchRef.current && mergeTries.current < 3) {
        mergeTries.current++
        try {
          const latest = await fetchRemote(c)
          if (latest) {
            pending.current = adoptScorekeeperScores(pending.current ?? next, latest.state)
            version.current = latest.updatedAt
            setExternal(latest)
            setSync("saving")
            void flush()
            return
          }
        } catch {
          /* fall through to the normal conflict handling */
        }
      }
      pending.current ??= next
      setSync(r.conflict ? "conflict" : "error")
      setSyncMessage(r.message)
      if (!r.conflict) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), retryMs.current)
        retryMs.current = Math.min(retryMs.current * 2, RETRY_MAX_MS)
      }
    }
  }, [])

  // Back online: send whatever is waiting straight away.
  useEffect(() => {
    const go = () => {
      if (!pending.current) return
      clearTimeout(timer.current)
      retryMs.current = RETRY_START_MS
      void flush()
    }
    window.addEventListener("online", go)
    return () => window.removeEventListener("online", go)
  }, [flush])

  // Editors call this after every change; the save waits for a pause so a burst is one write.
  const push = useCallback(
    (state: PooleanState) => {
      pending.current = state
      lsSet(UNSENT_KEY, "1")
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
    lsSet(UNSENT_KEY, "0")
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
      if (data.session && (await isEditor(c)) === false) {
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

  return { status, admin, email, remote, loaded, error, sync, syncMessage, recoverLocal, external, setWatchLive, refresh, push, overwrite, acceptRemote, signIn, signOut }
}

export type Cloud = ReturnType<typeof useCloud>
