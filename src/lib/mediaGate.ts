// Game recordings are 150 to 280 MB files. Opening the connection to their host as soon as a clip is on its way saves the connection
// setup (a round trip or two) on the first clip. (Making clips from one recording take turns was tried and measured no faster: each
// clip still has to pull its own few seconds of video, so the wait is that download, not the setup.)
const hosts = new Set<string>()

export function preconnect(url: string) {
  try {
    const origin = new URL(url).origin
    if (hosts.has(origin) || typeof document === "undefined") return
    hosts.add(origin)
    const link = document.createElement("link")
    link.rel = "preconnect"
    link.href = origin
    document.head.appendChild(link)
  } catch {
    /* not a URL; the video will fail on its own */
  }
}
