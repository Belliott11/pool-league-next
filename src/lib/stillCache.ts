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

// Points the video at `src` with CORS on, saves the frame at `at` seconds once it shows (and tells `onStill`), and falls back to a plain
// load when the host does not allow it.
export function loadWithStill(v: HTMLVideoElement, src: string, key: string, at: number, onStill?: (data: string) => void) {
  let saved = false
  const grab = () => {
    if (saved || v.readyState < 2 || Math.abs(v.currentTime - at) > 1.5 || !v.videoWidth) return
    try {
      const c = document.createElement("canvas")
      c.width = WIDTH
      c.height = Math.round((WIDTH * v.videoHeight) / v.videoWidth)
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height)
      const data = c.toDataURL("image/jpeg", 0.65)
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
