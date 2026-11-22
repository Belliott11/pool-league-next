// Short clip files (about 1 MB, see clipCuts.ts) fetched ahead of time and kept in memory, so a clip that is coming up (the next slides of
// Season Wrapped) starts the moment it is shown. The host sends no caching headers, so the browser's own cache cannot be relied on.
// Only cut files are fetched this way, never a full recording, and nothing is fetched with Data Saver on.
const ready = new Map<string, string>() // clip file -> object URL
const pending = new Set<string>()
const MAX = 10 // about 10 MB at most

export function prefetchClip(src: string) {
  if (!src.includes("/clips/") || ready.has(src) || pending.has(src) || typeof fetch === "undefined") return
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  pending.add(src)
  fetch(src, { mode: "cors" })
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then((b) => {
      ready.set(src, URL.createObjectURL(b))
      while (ready.size > MAX) {
        const [k, u] = ready.entries().next().value as [string, string]
        URL.revokeObjectURL(u)
        ready.delete(k)
      }
    })
    .catch(() => {}) // it just loads the usual way when shown
    .finally(() => pending.delete(src))
}

// The in-memory copy of a clip file, once it has arrived.
export const prefetched = (src: string): string | undefined => ready.get(src)
