// Web Push with nothing but WebCrypto, so it runs in Supabase's Deno and in Node the same way: the message encrypted for one phone
// (RFC 8291, aes128gcm) and signed with the site's VAPID key (RFC 8292). Tested by encrypting and decrypting in src/lib/webpush.test.ts.

export interface Subscription {
  endpoint: string
  p256dh: string // the phone's public key, base64url
  auth: string // the phone's auth secret, base64url
}
export interface Vapid {
  d: string // private key, base64url
  x: string
  y: string
  subject: string // who sends: an https address or mailto
}

const enc = new TextEncoder()
export const b64u = (b: Uint8Array<ArrayBuffer>) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
const cat = (...parts: Uint8Array<ArrayBuffer>[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let i = 0
  for (const p of parts) (out.set(p, i), (i += p.length))
  return out
}
async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data))
}

// The keys the message is encrypted with, from both sides' keys (shared by encrypt and the test's decrypt).
export async function contentKeys(shared: Uint8Array<ArrayBuffer>, auth: Uint8Array<ArrayBuffer>, uaPublic: Uint8Array<ArrayBuffer>, asPublic: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>) {
  const prkKey = await hmac(auth, shared)
  const ikm = await hmac(prkKey, cat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, cat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, cat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12)
  return { cek, nonce }
}

export async function encrypt(sub: Subscription, payload: string): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = unb64u(sub.p256dh)
  const auth = unb64u(sub.auth)
  const as = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey))
  const ua = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, as.privateKey, 256))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const { cek, nonce } = await contentKeys(shared, auth, uaPublic, asPublic, salt)
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"])
  // One record: the message, then 0x02 to mark it as the last.
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(enc.encode(payload), new Uint8Array([2]))))
  const rs = new Uint8Array([0, 0, 16, 0]) // record size 4096
  return cat(salt, rs, new Uint8Array([asPublic.length]), asPublic, body)
}

export async function vapidHeader(endpoint: string, v: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.subject })))
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: v.d, x: v.x, y: v.y, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${claims}`)))
  const publicKey = b64u(cat(new Uint8Array([4]), unb64u(v.x), unb64u(v.y)))
  return `vapid t=${header}.${claims}.${b64u(sig)}, k=${publicKey}`
}

// Sends one message; the status says what happened (201 delivered; 404 or 410 means the phone unsubscribed).
export async function send(sub: Subscription, payload: string, v: Vapid, ttl = 3600): Promise<number> {
  const body = await encrypt(sub, payload)
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(ttl), Urgency: "high", Authorization: await vapidHeader(sub.endpoint, v) },
    body,
  })
  return res.status
}
