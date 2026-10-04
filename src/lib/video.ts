// Game videos. Preferred home is Cloudflare R2: the `video-sign` Supabase function checks the caller is an
// editor and hands back a short-lived upload link, and the phone sends the file straight to R2, so size is
// no issue. If that function is not set up, files under 50 MB go to Supabase Storage (bucket `game-videos`,
// see supabase/storage.sql) instead. Both use XMLHttpRequest so the progress bar is real.
import { getClient, loadCloudConfig } from "./cloud"

const BUCKET = "game-videos"
const MAX_BYTES = 50 * 1024 * 1024 // Supabase free plan, per file
const MAX_R2_BYTES = 4 * 1024 * 1024 * 1024
const R2_PREFIX = "r2:"
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`
const MIME_BY_EXT: Record<string, string> = { mp4: "video/mp4", m4v: "video/x-m4v", mov: "video/quicktime", webm: "video/webm" }
const ALLOWED_MIME = Object.values(MIME_BY_EXT)

const ext = (name: string) => name.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? ""

// Browsers sometimes leave type empty for .mov, so fall back to the extension.
export function videoMime(file: { name: string; type: string }): string | null {
  const t = file.type || MIME_BY_EXT[ext(file.name)] || ""
  return ALLOWED_MIME.includes(t) ? t : null
}

// Returns a friendly message when the file cannot be uploaded, otherwise null.
export function checkVideoFile(file: { name: string; size: number; type: string }): string | null {
  if (!videoMime(file)) return "That does not look like a video. Use an MP4, MOV, M4V or WebM file, or paste a link instead."
  if (file.size > MAX_R2_BYTES) return "This video is over 4 GB. Trim it, or paste a link instead."
  return null
}

export function videoPathFromUrl(url: string): string | null {
  const i = url.indexOf(PUBLIC_MARKER)
  if (i < 0) return null
  const p = decodeURIComponent(url.slice(i + PUBLIC_MARKER.length).split(/[?#]/)[0])
  return p || null
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(url.split(/[?#]/)[0]) || videoPathFromUrl(url) !== null
}

// The 11-character id of a YouTube link (watch, short, embed, live or youtu.be), or null.
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(u.hostname)) return null
    const id = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : (u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1])
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export function embedKind(url: string): "file" | "youtube" | "vimeo" | "other" {
  if (isDirectVideoUrl(url)) return "file"
  if (/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(url)) return "youtube"
  if (/^https?:\/\/(www\.)?(vimeo\.com|player\.vimeo\.com)\//i.test(url)) return "vimeo"
  return "other"
}

// Asks the signing function for something; returns null when it is not deployed so callers can fall back.
async function callSign<T>(body: Record<string, string>): Promise<T | null> {
  const client = getClient()
  if (!client) return null
  const { data, error } = await client.functions.invoke("video-sign", { body })
  if (!error) return data as T
  const status = (error as { context?: Response }).context?.status
  if (status === 404 || error.name === "FunctionsFetchError") return null
  let msg = ""
  try { msg = ((await (error as { context: Response }).context.json()) as { error?: string }).error ?? "" } catch { /* not json */ }
  throw new Error(msg || "Could not start the upload.")
}

function putWithProgress(url: string, file: File, mime: string, onProgress?: (fraction: number) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", mime)
    let sent = 0
    xhr.upload.onprogress = (e) => {
      sent = e.loaded
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    // Nothing sent means the browser refused the request (storage rules or a rejected link); some sent
    // means the connection dropped part way.
    xhr.onerror = () =>
      reject(
        new Error(
          sent === 0
            ? "The upload was blocked before any of the video was sent. The storage rules or the upload link were refused."
            : `The connection dropped after ${Math.round(sent / 1024 / 1024)} of ${Math.round(file.size / 1024 / 1024)} MB. Stay on the page with the screen on, and try again.`,
        ),
      )
    xhr.onabort = () => reject(new Error("The upload was cancelled."))
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload failed (${xhr.status}).`)))
    xhr.send(file)
  })
}

export async function uploadGameVideo(
  file: File,
  gameId: string,
  onProgress?: (fraction: number) => void,
): Promise<{ url: string; path: string }> {
  const bad = checkVideoFile(file)
  if (bad) throw new Error(bad)
  const client = getClient()
  const cfg = await loadCloudConfig()
  if (!client || !cfg) throw new Error("Uploads need the shared-data cloud, which is not set up. Paste a link instead.")
  const { data } = await client.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("Sign in as an editor to upload videos.")

  const signed = await callSign<{ uploadUrl: string; key: string; publicUrl: string }>({ action: "put", gameId, name: file.name })
  if (signed) {
    await putWithProgress(signed.uploadUrl, file, videoMime(file)!, onProgress)
    onProgress?.(1)
    return { url: signed.publicUrl, path: R2_PREFIX + signed.key }
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`This file is ${Math.round(file.size / 1024 / 1024)} MB and big uploads are not set up yet. Under 50 MB works, or paste a YouTube link.`)
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "video"
  const path = `${gameId}/${Date.now()}-${safeName}`
  const endpoint = `${cfg.url}/storage/v1/object/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", endpoint)
    xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("apikey", cfg.anonKey)
    xhr.setRequestHeader("Content-Type", videoMime(file)!)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."))
    xhr.onabort = () => reject(new Error("The upload was cancelled."))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let msg = ""
      try { msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? "" } catch { /* not json */ }
      if (xhr.status === 401 || xhr.status === 403) msg = "This account is not allowed to upload videos. Only editors can."
      else if (xhr.status === 413) msg = "The server says this file is too large. The free plan allows 50 MB per video."
      reject(new Error(msg || `The upload failed (${xhr.status}).`))
    }
    xhr.send(file)
  })
  onProgress?.(1)
  return { url: client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, path }
}

export async function deleteGameVideo(path: string): Promise<void> {
  const client = getClient()
  if (!client) throw new Error("The shared-data cloud is not set up.")
  if (path.startsWith(R2_PREFIX)) {
    await callSign({ action: "delete", key: path.slice(R2_PREFIX.length) })
    return
  }
  const { error } = await client.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
}
