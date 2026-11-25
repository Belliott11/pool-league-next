import { getClient, loadCloudConfig } from "@/lib/cloud"
import { deviceKey } from "@/lib/deviceKey"

// Game alerts: a notification on this phone when a game goes live and when it ends (supabase/alerts.sql, the game-alerts function).
// Turned on from a tap (phones only ask for permission then). An iPhone can only get them from the site saved to its Home Screen.

export type AlertSupport = "yes" | "home-screen-first" | "no"

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function alertSupport(): AlertSupport {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return "no"
  if (isIos() && !standalone()) return "home-screen-first"
  return "PushManager" in window && "Notification" in window ? "yes" : "no"
}

async function functionUrl(): Promise<string | null> {
  const cfg = await loadCloudConfig()
  return cfg ? `${cfg.url.replace(/\/$/, "")}/functions/v1/game-alerts` : null
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const have = await navigator.serviceWorker.getRegistration()
  if (have) return have
  await navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js")
  return navigator.serviceWorker.ready
}

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const raw = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function alertsOn(): Promise<boolean> {
  if (alertSupport() !== "yes" || Notification.permission !== "granted") return false
  const reg = await navigator.serviceWorker.getRegistration()
  return !!(await reg?.pushManager.getSubscription())
}

// Turns alerts on. Call from a tap. Says why when it cannot.
export async function turnAlertsOn(): Promise<{ ok: true } | { ok: false; why: string }> {
  if (alertSupport() !== "yes") return { ok: false, why: "This browser cannot show game alerts." }
  const permission = await Notification.requestPermission()
  if (permission !== "granted") return { ok: false, why: "Notifications are turned off for this site. Allow them in the phone's settings, then try again." }
  try {
    const url = await functionUrl()
    const client = getClient()
    if (!url || !client) return { ok: false, why: "No connection right now. Try again in a moment." }
    const { publicKey } = (await (await fetch(url)).json()) as { publicKey: string }
    const reg = await registration()
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const { data, error } = await client.rpc("save_push_subscription", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_key: deviceKey() })
    if (error || data !== true) return { ok: false, why: "Could not save it. Try again in a moment." }
    // A first notification right away, so the phone shows that it works.
    void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hello: j.endpoint }) }).catch(() => {})
    return { ok: true }
  } catch {
    return { ok: false, why: "Could not turn alerts on. Try again in a moment." }
  }
}

export async function turnAlertsOff(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await getClient()?.rpc("delete_push_subscription", { p_endpoint: sub.endpoint, p_key: deviceKey() })
  await sub.unsubscribe().catch(() => {})
}
