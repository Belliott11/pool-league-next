// A clip's still frame, kept on the device so the next visit shows it at once without touching the 150 to 280 MB recording. A frame can
// only be read off a video the host allows the site to read (CORS, set on the video bucket), so a video is loaded with that on and, if
// the host refuses, loaded again the plain way: the clip still plays, it just isn't saved.
const PREFIX = "clipStill:"
const INDEX = "clipStill:index"
const MAX = 40 // frames kept, oldest dropped first; about 15 KB each, so well under the 5 MB a site gets
const WIDTH = 400

// Same recording and moment, however the URL is signed or fragmented.
export const stillKey = (url: string, time: number) => `${url.split(/[?#]/)[0].split("/").slice(-2).join("/")}|${Math.round(time)}`

export function readStill(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

export function writeStill(key: string, data: string) {
  try {
    const keys: string[] = JSON.parse(localStorage.getItem(INDEX) ?? "[]").filter((k: string) => k !== key)
    keys.push(key)
    while (keys.length > MAX) localStorage.removeItem(PREFIX + keys.shift())
    localStorage.setItem(PREFIX + key, data)
    localStorage.setItem(INDEX, JSON.stringify(keys))
  } catch {
    /* storage full or blocked: skip saving */
  }
}

// Auto framing. The action is in the pool, and the camera sits differently from game to game, so the crop is found from the water in a
// saved frame (blue well above red): its bounding box, ignoring stray pixels, padded a little. Kept per recording as how far to zoom and
// where on the picture to center. ponytail: finds water only; a recording with no pool in view keeps the plain centered crop.
export interface Frame { z: number; x: number; y: number } // zoom, then the focus point as 0..1 of the picture
const FRAME = "clipFrame:"
const recordingOf = (url: string) => url.split(/[?#]/)[0].split("/").slice(-2).join("/")
export function readFrame(url: string): Frame | null {
  try {
    return JSON.parse(localStorage.getItem(FRAME + recordingOf(url)) ?? "null")
  } catch {
    return null
  }
}
export function waterFrame(px: Uint8ClampedArray, w: number, h: number): Frame | null {
  const cols = new Array<number>(w).fill(0)
  const rows = new Array<number>(h).fill(0)
  let n = 0
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]
    if (b > 90 && b > r + 40 && g > r + 10) (cols[i % w]++, rows[Math.floor(i / w)]++, n++)
  }
  if (n < w * h * 0.08) return null
  const edge = (a: number[], p: number) => { // where the p share of water pixels is reached, as 0..1 along the axis
    let s = 0
    for (let i = 0; i < a.length; i++) if ((s += a[i]) >= n * p) return i / a.length
    return 1
  }
  const x0 = Math.max(0, edge(cols, 0.02) - 0.05), x1 = Math.min(1, edge(cols, 0.98) + 0.05)
  const y0 = Math.max(0, edge(rows, 0.02) - 0.05), y1 = Math.min(1, edge(rows, 0.98) + 0.05)
  const z = Math.min(1.8, 1 / Math.max(x1 - x0, y1 - y0))
  return z < 1.1 ? null : { z, x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}
// The scale and origin that put the focus point mid-picture at that zoom, without showing past the edges.
export function frameStyle(f: Frame | null): { transform: string; transformOrigin: string } | undefined {
  if (!f || f.z < 1.02) return undefined
  const o = (p: number) => Math.max(0, Math.min(1, (f.z * p - 0.5) / (f.z - 1))) * 100
  return { transform: `scale(${f.z.toFixed(3)})`, transformOrigin: `${o(f.x).toFixed(1)}% ${o(f.y).toFixed(1)}%` }
}

// The same crop for a box of any shape. A video that fills a box by cover-fit is cropped (a phone's tall box shows a thin slice of a wide
// picture), so the focus point is worked out on the picture as it is laid out, not on the box. The picture is moved so the focus sits mid-box
// when it can, and never so far that the box shows past the picture: a point near a side ends up at the box's edge, still on screen.
export function coverStyle(f: Frame | null, W: number, H: number, vw = 1280, vh = 720): { transform: string; transformOrigin: string } | undefined {
  if (!f || f.z < 1.02 || !W || !H) return undefined
  const s0 = Math.max(W / vw, H / vh)
  const Wd = vw * s0, Hd = vh * s0 // the picture as laid out
  const ox = (W - Wd) / 2, oy = (H - Hd) / 2
  const cx = W / 2, cy = H / 2
  const pan = (target: number, c: number, o: number, D: number, size: number) =>
    Math.min(-c - f.z * (o - c), Math.max(size - c - f.z * (o + D - c), -f.z * (target - c)))
  const dx = pan(ox + f.x * Wd, cx, ox, Wd, W)
  const dy = pan(oy + f.y * Hd, cy, oy, Hd, H)
  return { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${f.z.toFixed(3)})`, transformOrigin: "50% 50%" }
}

// Points the video at `src` with CORS on, saves the frame at `at` seconds once it shows (and tells `onStill`), and falls back to a plain
// load when the host does not allow it. `recording` is the full game recording when `src` is a short cut of it, so the pool crop found
// from the frame is kept for the recording either way.
export function loadWithStill(v: HTMLVideoElement, src: string, key: string, at: number, onStill?: (data: string) => void, recording = src) {
  let saved = false
  const grab = () => {
    if (saved || v.readyState < 2 || Math.abs(v.currentTime - at) > 1.5 || !v.videoWidth) return
    try {
      const c = document.createElement("canvas")
      c.width = WIDTH
      c.height = Math.round((WIDTH * v.videoHeight) / v.videoWidth)
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height)
      const ctx = c.getContext("2d")!
      const data = c.toDataURL("image/jpeg", 0.65)
      if (!readFrame(recording)) {
        const f = waterFrame(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)
        try { localStorage.setItem(FRAME + recordingOf(recording), JSON.stringify(f)) } catch { /* skip */ }
      }
      saved = true
      writeStill(key, data)
      onStill?.(data)
    } catch {
      saved = true // a video that is not CORS-readable stays that way: do not retry
    }
  }
  v.addEventListener("loadeddata", grab)
  v.addEventListener("seeked", grab)
  v.addEventListener(
    "error",
    () => {
      v.removeAttribute("crossorigin")
      v.src = src
    },
    { once: true },
  )
  v.crossOrigin = "anonymous"
  v.src = src
}
