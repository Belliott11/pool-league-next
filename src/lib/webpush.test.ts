import { describe, expect, it } from "vitest"
import { b64u, contentKeys, encrypt, unb64u, vapidHeader } from "../../supabase/functions/game-alerts/webpush"

// A pretend phone: its own key pair and auth secret, as a browser's push subscription has.
async function phone() {
  const kp = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { kp, sub: { endpoint: "https://push.example.com/abc", p256dh: b64u(pub), auth: b64u(auth) }, pub, auth }
}

describe("web push", () => {
  it("encrypts a message the phone can decrypt", async () => {
    const p = await phone()
    const msg = JSON.stringify({ title: "Game on", body: "Ben, Zach vs Adam, Ian" })
    const out = await encrypt(p.sub, msg)
    // Header: salt (16), record size (4), key id length (1), the sender's public key (65), then the encrypted record.
    const salt = out.slice(0, 16)
    expect(out[20]).toBe(65)
    const asPublic = out.slice(21, 86)
    const as = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, [])
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: as }, p.kp.privateKey, 256))
    const { cek, nonce } = await contentKeys(shared, p.auth, p.pub, asPublic, salt)
    const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"])
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, out.slice(86)))
    expect(plain.at(-1)).toBe(2)
    expect(new TextDecoder().decode(plain.slice(0, -1))).toBe(msg)
  })
  it("signs the VAPID header so the push service can check it", async () => {
    const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair
    const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey)
    const h = await vapidHeader("https://web.push.apple.com/xyz", { d: jwk.d!, x: jwk.x!, y: jwk.y!, subject: "https://intel.poolean.net" })
    const [, token, k] = h.match(/^vapid t=([^,]+), k=(.+)$/)!
    const [hd, cl, sig] = token.split(".")
    expect(JSON.parse(new TextDecoder().decode(unb64u(cl))).aud).toBe("https://web.push.apple.com")
    expect(unb64u(k)).toHaveLength(65)
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kp.publicKey, unb64u(sig), new TextEncoder().encode(`${hd}.${cl}`))
    expect(ok).toBe(true)
  })
})
