import { coverStyle } from "@/lib/stillCache"

// Following a ball or a player through a clip. The editor taps the thing on a frame, and the picture is followed forward by matching
// that small patch of colour in each next frame near where it last was. What is saved is only the path (time and place, 0..1 of the
// picture), so visitors just play it back. ponytail: plain patch matching, no model; it loses a target that is hidden or looks like its
// surroundings, which is why the editor sees the path, can add taps, and clears it.
export interface TrackPoint { t: number; x: number; y: number }
export interface Img { data: Uint8ClampedArray; w: number; h: number }

const R = 4 // the patch is (2R+1) square pixels, on a picture 480 wide

export const sortTrack = (track: TrackPoint[]) => [...track].sort((a, b) => a.t - b.t)

// Where the camera is at time t: straight lines between points, held at the ends.
export function atTime(track: TrackPoint[], t: number): { x: number; y: number } | null {
  if (!track.length) return null
  if (t <= track[0].t) return track[0]
  const last = track[track.length - 1]
  if (t >= last.t) return last
  let i = 1
  while (track[i].t < t) i++
  const a = track[i - 1], b = track[i]
  const k = (t - a.t) / (b.t - a.t)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
}

// A few neighbours averaged, so a jittery path turns into a smooth camera.
export function smooth(track: TrackPoint[]): TrackPoint[] {
  return track.map((p, i) => {
    const near = track.slice(Math.max(0, i - 2), i + 3)
    return { t: p.t, x: near.reduce((s, q) => s + q.x, 0) / near.length, y: near.reduce((s, q) => s + q.y, 0) / near.length }
  })
}

export function patchAt(img: Img, cx: number, cy: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray((2 * R + 1) ** 2 * 3)
  let k = 0
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const px = Math.min(img.w - 1, Math.max(0, Math.round(cx) + x)), py = Math.min(img.h - 1, Math.max(0, Math.round(cy) + y))
      const i = (py * img.w + px) * 4
      out[k++] = img.data[i]
      out[k++] = img.data[i + 1]
      out[k++] = img.data[i + 2]
    }
  return out
}

// The place within `radius` pixels of (cx, cy) whose patch is closest to `tpl`, and how far off it is (per value, 0..255).
export function findPatch(img: Img, tpl: Uint8ClampedArray, cx: number, cy: number, radius: number): { x: number; y: number; miss: number } {
  let best = { x: cx, y: cy, miss: Infinity }
  for (let y = Math.max(R, Math.round(cy) - radius); y <= Math.min(img.h - 1 - R, Math.round(cy) + radius); y++)
    for (let x = Math.max(R, Math.round(cx) - radius); x <= Math.min(img.w - 1 - R, Math.round(cx) + radius); x++) {
      let cost = 0, k = 0, worse = false
      for (let dy = -R; dy <= R && !worse; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const i = ((y + dy) * img.w + (x + dx)) * 4
          const a = img.data[i] - tpl[k++], b = img.data[i + 1] - tpl[k++], c = img.data[i + 2] - tpl[k++]
          cost += Math.abs(a) + Math.abs(b) + Math.abs(c)
        }
        worse = cost >= best.miss * tpl.length // already worse than the best so far: stop early
      }
      if (worse) continue
      const miss = cost / tpl.length
      if (miss < best.miss) best = { x, y, miss }
    }
  return best
}

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((done) => {
    const finish = () => (v.removeEventListener("seeked", finish), clearTimeout(timer), done())
    const timer = setTimeout(finish, 4000)
    v.addEventListener("seeked", finish)
    v.currentTime = t
  })

// Follows the thing tapped at `from` forward to time `to`, a frame every `step` seconds. Returns the points after the tap (not the tap).
// Needs a video the page may read pixels from. `stop()` ends it early; `onPoint` reports each point as it is found.
export async function followFrom(v: HTMLVideoElement, from: TrackPoint, to: number, opts: { step?: number; signal?: { stopped: boolean }; onPoint?: (p: TrackPoint) => void } = {}): Promise<TrackPoint[]> {
  const step = opts.step ?? 0.12
  const w = 480, h = Math.round((w * v.videoHeight) / v.videoWidth)
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d", { willReadFrequently: true })!
  const read = async (t: number): Promise<Img> => {
    await seek(v, t)
    ctx.drawImage(v, 0, 0, w, h)
    return { data: ctx.getImageData(0, 0, w, h).data, w, h }
  }
  let x = from.x * w, y = from.y * h
  let tpl = patchAt(await read(from.t), x, y)
  const out: TrackPoint[] = []
  for (let t = from.t + step; t <= to + 1e-6 && !opts.signal?.stopped; t += step) {
    const img = await read(t)
    const hit = findPatch(img, tpl, x, y, 70)
    if (hit.miss < 60) { // held where it was if nothing looks like it
      x = hit.x
      y = hit.y
      const now = patchAt(img, x, y)
      tpl = tpl.map((v0, i) => Math.round(v0 * 0.85 + now[i] * 0.15)) as unknown as Uint8ClampedArray // learns how it changes
    }
    const p = { t, x: x / w, y: y / h }
    out.push(p)
    opts.onPoint?.(p)
  }
  return out
}

// While a clip plays, keeps the camera on its path: zoomed on the target and eased toward it. Returns a stop function.
// `offset`: the recording time the video's first frame is at, when it plays a short cut of the recording rather than the whole thing.
export function followPlayback(v: HTMLVideoElement, track: TrackPoint[], zoom: number, offset = 0): () => void {
  let raf = 0
  let cur: { x: number; y: number } | null = null
  const tick = () => {
    const p = atTime(track, v.currentTime + offset)
    if (p) {
      cur = cur ? { x: cur.x + (p.x - cur.x) * 0.2, y: cur.y + (p.y - cur.y) * 0.2 } : p
      const box = v.parentElement! // the box that crops the picture, not the picture
      const s = coverStyle({ z: zoom, x: cur.x, y: cur.y }, box.clientWidth, box.clientHeight, v.videoWidth || 1280, v.videoHeight || 720)
      v.style.transform = s?.transform ?? ""
      v.style.transformOrigin = s?.transformOrigin ?? ""
    }
    raf = requestAnimationFrame(tick)
  }
  tick()
  return () => {
    cancelAnimationFrame(raf)
    v.style.transform = ""
    v.style.transformOrigin = ""
  }
}
