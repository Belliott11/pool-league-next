import cuts from "@/data/clip-cuts.json"

// Short files cut from the game recordings, one per clip, so a clip loads a few hundred KB instead of a 150 to 280 MB recording.
// `npm run cut-clips` makes them (scripts/cut-clips.mjs) and lists them in src/data/clip-cuts.json. A clip with no cut, or one an editor
// has trimmed differently since, plays from the full recording as before.

export const CUT_LEAD = 5 // seconds before the play a cut starts (a tile plays from here; a backdrop from 3 before)
export const CUT_TAIL = 6 // and after it, when the editor did not set an end

const r2 = (n: number) => Math.round(n * 100) / 100

// The stretch of the recording a clip's cut holds.
export const cutWindow = (c: { time: number; from?: number; to?: number }) => ({ start: r2(Math.max(0, c.from ?? c.time - CUT_LEAD)), end: r2(c.to ?? c.time + CUT_TAIL) })

// The recording's file name and the stretch, which is how a cut is found again.
export const cutKey = (url: string, w: { start: number; end: number }) => `${url.split(/[?#]/)[0].split("/").pop()}|${w.start}|${w.end}`

const table = cuts as Record<string, string>

// Where to play a clip from: its cut when there is one (with `offset`, the recording time the cut's first frame is at), else the recording.
// Times in the recording become times in the cut by taking away `offset`.
export function clipSource(url: string, clip: { time: number; from?: number; to?: number }): { src: string; offset: number; cut: boolean } {
  const bare = url.split("#")[0]
  const w = cutWindow(clip)
  const path = table[cutKey(url, w)]
  if (!path) return { src: bare, offset: 0, cut: false }
  try {
    return { src: `${new URL(bare).origin}/${path}`, offset: w.start, cut: true }
  } catch {
    return { src: bare, offset: 0, cut: false }
  }
}
