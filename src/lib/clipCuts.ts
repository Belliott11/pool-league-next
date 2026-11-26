import cuts from "@/data/clip-cuts.json"
import { atTime, smooth, sortTrack, type TrackPoint } from "@/lib/track"

// Short files cut from the game recordings, one per clip, so a clip loads a few hundred KB instead of a 150 to 280 MB recording.
// `npm run cut-clips` makes them (scripts/cut-clips.mjs) and lists them in src/data/clip-cuts.json. A clip with no cut, or one an editor
// has trimmed differently since, plays from the full recording as before.
//
// A clip with a follow path (the ball or a player, set in the clip editor) is cut with the follow camera already in the picture: zoomed
// and panned along the path, so every player (the tiles, a tap with sound, share links, the trailer) shows the followed version. Its key
// carries a tag of the path and zoom, so changing the follow cuts it again; until then it plays from the recording with the camera
// following in the browser.

export const CUT_LEAD = 5 // seconds before the play a cut starts (a tile plays from here; a backdrop from 3 before)
export const CUT_TAIL = 6 // and after it, when the editor did not set an end

const r2 = (n: number) => Math.round(n * 100) / 100

// The stretch of the recording a clip's cut holds.
export const cutWindow = (c: { time: number; from?: number; to?: number }) => ({ start: r2(Math.max(0, c.from ?? c.time - CUT_LEAD)), end: r2(c.to ?? c.time + CUT_TAIL) })

// The recording's file name and the stretch, which is how a cut is found again.
export const cutKey = (url: string, w: { start: number; end: number }) => `${url.split(/[?#]/)[0].split("/").pop()}|${w.start}|${w.end}`

export const DEFAULT_ZOOM = 2 // the follow camera's zoom when the editor did not set one (as ClipBackdrop)

// The follow camera for a clip, or null. The zoom is the editor's frame zoom; under 1.05 there is nothing to follow with.
export function followOf(c: { track?: TrackPoint[]; frame?: { z: number } }): { track: TrackPoint[]; zoom: number } | null {
  if (!c.track?.length) return null
  const zoom = Math.round((c.frame?.z ?? DEFAULT_ZOOM) * 100) / 100
  return zoom >= 1.05 ? { track: sortTrack(c.track), zoom } : null
}

// A short tag for a follow path and zoom, so a cut is made again when either changes.
export function followTag(f: { track: TrackPoint[]; zoom: number }): string {
  let h = 0x811c9dc5
  const text = `${f.zoom}|${f.track.map((p) => `${p.t.toFixed(2)},${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(";")}`
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0
  return h.toString(36)
}

// The key a clip's cut is listed under: the recording and stretch, plus the follow tag for a followed clip.
export function clipCutKey(url: string, c: { time: number; from?: number; to?: number; track?: TrackPoint[]; frame?: { z: number } }): string {
  const f = followOf(c)
  return cutKey(url, cutWindow(c)) + (f ? `|f${followTag(f)}` : "")
}

// The camera's path through a cut, for scripts/cut-clips.mjs: cut time (0 at the cut's start) and place (0..1 of the picture), every
// 0.2 s, smoothed the same way as the camera in the browser.
export function cutPath(c: { time: number; from?: number; to?: number; track?: TrackPoint[]; frame?: { z: number } }, w = cutWindow(c)): { zoom: number; path: TrackPoint[] } | null {
  const f = followOf(c)
  if (!f) return null
  const sm = smooth(f.track)
  const path: TrackPoint[] = []
  for (let t = w.start; t <= w.end + 1e-6; t += 0.2) {
    const p = atTime(sm, t)!
    path.push({ t: r2(t - w.start), x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 })
  }
  return { zoom: f.zoom, path }
}

// The stretch a reel (the season trailer, a player's mixtape) shows of a play: at least REEL_LEAD before the logged moment and REEL_TAIL
// after it, or REEL_PAST past the editor's own end, whichever is later. The editor's trim is often tight (set while placing a follow,
// or the default 4 s after the moment), which cut plays off before the basket in the reels; the clip itself keeps the trim.
export const REEL_LEAD = 3
export const REEL_TAIL = 5
export const REEL_PAST = 1.5
export const reelWindow = (c: { time: number; from?: number; to?: number }) => {
  const w = cutWindow(c)
  return { start: r2(Math.max(0, Math.min(w.start, c.time - REEL_LEAD))), end: r2(Math.max(w.end + REEL_PAST, c.time + REEL_TAIL)) }
}

const table = cuts as Record<string, string>

// Where to play a clip from: its cut when there is one (with `offset`, the recording time the cut's first frame is at), else the recording.
// Times in the recording become times in the cut by taking away `offset` (callers keep the result at 0 or more: the stretch is rounded).
// `followed`: the cut already has the follow camera in it, so nothing should crop or pan it again.
export function clipSource(url: string, clip: { time: number; from?: number; to?: number; track?: TrackPoint[]; frame?: { z: number } }): { src: string; offset: number; cut: boolean; followed: boolean } {
  const bare = url.split("#")[0]
  const w = cutWindow(clip)
  const key = clipCutKey(url, clip)
  const path = table[key]
  if (!path) return { src: bare, offset: 0, cut: false, followed: false }
  try {
    return { src: `${new URL(bare).origin}/${path}`, offset: w.start, cut: true, followed: key.includes("|f") }
  } catch {
    return { src: bare, offset: 0, cut: false, followed: false }
  }
}
