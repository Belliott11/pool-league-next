import type { Game, PooleanState } from "@/lib/types"

// Placing games in a recording by the clock. A phone writes when it started recording into the video file (the "mvhd" box of an MP4 or
// MOV, in seconds since 1904). Live games save when they started and finished (Game.startedAt/endedAt), and each basket when it was
// scored, so a game's place in the recording is just the difference. Exported or edited copies usually lose that time; then the file's
// own date (when it was last written, roughly when recording stopped) less the video's length stands in.

const MAC_EPOCH = Date.UTC(1904, 0, 1)
const CHUNK = 8 * 1024 * 1024 // the box sits near the start or near the end of the file

// The start time written in the bytes of an MP4/MOV, or null. Looks for the movie header box and reads its creation time.
export function mvhdStart(bytes: Uint8Array): number | null {
  for (let i = 4; i + 24 < bytes.length; i++) {
    if (bytes[i] !== 0x6d || bytes[i + 1] !== 0x76 || bytes[i + 2] !== 0x68 || bytes[i + 3] !== 0x64) continue // "mvhd"
    const view = new DataView(bytes.buffer, bytes.byteOffset + i + 4)
    const version = view.getUint8(0)
    const secs = version === 1 ? Number(view.getBigUint64(4)) : view.getUint32(4)
    const ms = MAC_EPOCH + secs * 1000
    if (ms > Date.UTC(2010, 0, 1) && ms < Date.now() + 86_400_000) return ms // a real recording date, not an empty field
  }
  return null
}

// When a recording file started, in ms since 1970: from its header, else its file date less its length. Null when neither is known.
export async function recordingStart(file: File, durationSeconds?: number): Promise<number | null> {
  const read = async (from: number, to: number) => new Uint8Array(await file.slice(Math.max(0, from), Math.min(file.size, to)).arrayBuffer())
  const fromHeader = mvhdStart(await read(0, CHUNK)) ?? (file.size > CHUNK ? mvhdStart(await read(file.size - CHUNK, file.size)) : null)
  if (fromHeader) return fromHeader
  return durationSeconds && file.lastModified ? file.lastModified - durationSeconds * 1000 : null
}

// When the recording a game is in started, in ms since 1970, if known.
export function recordingStartOf(state: PooleanState, game: Game): number | null {
  const master = game.masterVideoId ? state.masterVideos?.find((m) => m.id === game.masterVideoId) : undefined
  const at = game.videoUrl ? game.recordedAt : (master?.recordedAt ?? game.recordedAt)
  return at ? Date.parse(at) : null
}

// Reads a video file's length in seconds without uploading it. Null if the browser cannot tell within a few seconds.
export function fileDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video")
    const url = URL.createObjectURL(file)
    const done = (d: number | null) => (URL.revokeObjectURL(url), resolve(d))
    const timer = setTimeout(() => done(null), 8000)
    v.preload = "metadata"
    v.onloadedmetadata = () => (clearTimeout(timer), done(Number.isFinite(v.duration) ? v.duration : null))
    v.onerror = () => (clearTimeout(timer), done(null))
    v.src = url
  })
}

const BEFORE = 20 // seconds of run-up kept before a game's first moment
const AFTER = 10 // and after its last

// Fills in where each live-scored game in a recording starts and ends, for games that have saved times and no place typed by hand.
// `inRecording` picks the games that share the recording.
export function placeGames(state: PooleanState, inRecording: (g: Game) => boolean, startMs: number, durationSeconds: number): { state: PooleanState; placed: number } {
  let placed = 0
  const games = state.games.map((g) => {
    if (!inRecording(g) || !g.startedAt || g.videoStart) return g
    const start = (Date.parse(g.startedAt) - startMs) / 1000 - BEFORE
    const end = g.endedAt ? (Date.parse(g.endedAt) - startMs) / 1000 + AFTER : undefined
    if (!(start > -BEFORE && start < durationSeconds)) return g // the game was not during this recording
    placed++
    return { ...g, videoStart: Math.max(0, Math.round(start)), ...(end !== undefined ? { videoEnd: Math.min(durationSeconds, Math.round(end)) } : {}) }
  })
  return { state: placed ? { ...state, games } : state, placed }
}
