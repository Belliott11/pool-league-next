// Signs short-lived Cloudflare R2 upload links for league editors, so a phone can send a video of any
// size straight to R2 without it passing through Supabase. Only accounts listed in `admins` get a link.
//
// Secrets this function reads (set them in Supabase: Edge Functions > Secrets):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase itself.
import { createClient } from "npm:@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } })

const enc = new TextEncoder()
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("")
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)))
async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  return crypto.subtle.sign("HMAC", k, enc.encode(data))
}
const uriEncode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase())

// AWS Signature Version 4, query-string style, which R2 accepts as a presigned URL.
async function presign(method: "PUT" | "DELETE" | "HEAD" | "GET" | "POST", key: string, expires: number, extra: Record<string, string> = {}): Promise<string> {
  const account = Deno.env.get("R2_ACCOUNT_ID")!
  const accessKey = Deno.env.get("R2_ACCESS_KEY_ID")!
  const secret = Deno.env.get("R2_SECRET_ACCESS_KEY")!
  const bucket = Deno.env.get("R2_BUCKET")!
  const host = `${account}.r2.cloudflarestorage.com`
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "")
  const day = amzDate.slice(0, 8)
  const scope = `${day}/auto/s3/aws4_request`
  const path = `/${bucket}/${key.split("/").map(uriEncode).join("/")}`
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": "host",
    ...extra,
  }
  const canonicalQuery = Object.keys(query).sort().map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`).join("&")
  const canonical = [method, path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n")
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256(canonical)].join("\n")
  let k = await hmac(enc.encode("AWS4" + secret), day)
  k = await hmac(k, "auto")
  k = await hmac(k, "s3")
  k = await hmac(k, "aws4_request")
  const signature = hex(await hmac(k, toSign))
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return json({ error: "Use POST." }, 405)

  const auth = req.headers.get("Authorization") ?? ""
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } })
  const { data: user } = await supabase.auth.getUser()
  if (!user?.user) return json({ error: "Sign in as an editor." }, 401)
  // RLS shows an account only its own row, so a row here means this account is an editor.
  const { data: admin } = await supabase.from("admins").select("user_id").maybeSingle()
  if (!admin) return json({ error: "Only editors can upload videos." }, 403)

  // R2 answers a bad key with an error that browsers hide (no CORS headers), which shows up as a vague
  // "check your connection". Checking here, with a throwaway lookup, turns it into a readable message.
  const missing = REQUIRED.filter((n) => !Deno.env.get(n))
  if (missing.length) return json({ error: `Setup is missing these Supabase secrets: ${missing.join(", ")}.` }, 500)
  try {
    const probe = await fetch(await presign("HEAD", "videos/.check", 60), { method: "HEAD" })
    if (probe.status !== 404 && !probe.ok) {
      return json({ error: `Cloudflare rejected the credentials (${probe.status}). Re-check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET for typos or extra spaces.` }, 500)
    }
  } catch {
    return json({ error: "Could not reach Cloudflare R2. Check R2_ACCOUNT_ID." }, 500)
  }

  let body: { action?: string; gameId?: string; name?: string; key?: string; uploadId?: string; partNumber?: number; partCount?: number; contentType?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Bad request." }, 400)
  }

  if (body.action === "put") {
    const gameId = String(body.gameId ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
    const name = String(body.name ?? "video").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "video"
    if (!gameId) return json({ error: "Missing game." }, 400)
    const key = `videos/${gameId}/${Date.now()}-${name}`
    const base = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "")
    return json({ uploadUrl: await presign("PUT", key, 3600), key, publicUrl: `${base}/${key.split("/").map(encodeURIComponent).join("/")}` })
  }

  // Big files go up in parts so a dropped connection only repeats one part, not the whole video.
  // create -> sign each part -> complete (the server reads the part list itself, so the browser never
  // needs to see Cloudflare's ETag headers).
  if (body.action === "mp-create") {
    const gameId = String(body.gameId ?? "").replace(/[^a-zA-Z0-9_-]/g, "")
    const name = String(body.name ?? "video").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "video"
    if (!gameId) return json({ error: "Missing game." }, 400)
    const key = `videos/${gameId}/${Date.now()}-${name}`
    const res = await fetch(await presign("POST", key, 120, { uploads: "" }), { method: "POST", headers: { "Content-Type": String(body.contentType ?? "video/mp4") } })
    const xml = await res.text()
    const uploadId = xml.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1]
    if (!res.ok || !uploadId) return json({ error: `Could not start the upload (${res.status}).` }, 502)
    const base = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "")
    return json({ key, uploadId, publicUrl: `${base}/${key.split("/").map(encodeURIComponent).join("/")}` })
  }

  if (body.action === "mp-sign" || body.action === "mp-complete" || body.action === "mp-abort") {
    const key = String(body.key ?? "")
    const uploadId = String(body.uploadId ?? "")
    if (!key.startsWith("videos/") || key.includes("..") || !uploadId) return json({ error: "Bad upload." }, 400)
    if (body.action === "mp-sign") {
      const n = Number(body.partNumber)
      if (!Number.isInteger(n) || n < 1 || n > 10000) return json({ error: "Bad part." }, 400)
      return json({ uploadUrl: await presign("PUT", key, 3600, { partNumber: String(n), uploadId }) })
    }
    if (body.action === "mp-abort") {
      await fetch(await presign("DELETE", key, 60, { uploadId }), { method: "DELETE" })
      return json({ ok: true })
    }
    // complete: list what arrived, then stitch the parts together in order
    const parts: { n: number; etag: string }[] = []
    let marker = "0"
    for (let page = 0; page < 20; page++) {
      const res = await fetch(await presign("GET", key, 60, { uploadId, "part-number-marker": marker }))
      const xml = await res.text()
      if (!res.ok) return json({ error: `Could not read the uploaded parts (${res.status}).` }, 502)
      for (const m of xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)) {
        const n = Number(m[1].match(/<PartNumber>(\d+)<\/PartNumber>/)?.[1])
        const etag = m[1].match(/<ETag>([^<]+)<\/ETag>/)?.[1]
        if (n && etag) parts.push({ n, etag })
      }
      if (!/<IsTruncated>true<\/IsTruncated>/.test(xml)) break
      marker = xml.match(/<NextPartNumberMarker>(\d+)<\/NextPartNumberMarker>/)?.[1] ?? marker
    }
    parts.sort((a, b) => a.n - b.n)
    const expected = Number(body.partCount)
    if (parts.length === 0 || (expected && parts.length !== expected)) return json({ error: `Only ${parts.length} of ${expected} parts arrived. Try the upload again.` }, 409)
    const xmlBody = `<CompleteMultipartUpload>${parts.map((p) => `<Part><PartNumber>${p.n}</PartNumber><ETag>${p.etag}</ETag></Part>`).join("")}</CompleteMultipartUpload>`
    const done = await fetch(await presign("POST", key, 120, { uploadId }), { method: "POST", headers: { "Content-Type": "application/xml" }, body: xmlBody })
    const text = await done.text()
    // R2 can answer 200 with an error body, so check the body too.
    if (!done.ok || /<Error>/.test(text)) return json({ error: `Could not finish the upload (${done.status}).` }, 502)
    return json({ ok: true })
  }

  if (body.action === "delete") {
    const key = String(body.key ?? "")
    if (!key.startsWith("videos/") || key.includes("..")) return json({ error: "Not a video key." }, 400)
    const res = await fetch(await presign("DELETE", key, 60), { method: "DELETE" })
    return res.ok || res.status === 404 ? json({ ok: true }) : json({ error: `Delete failed (${res.status}).` }, 502)
  }

  return json({ error: "Unknown action." }, 400)
})
