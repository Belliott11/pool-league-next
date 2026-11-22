import shares from "@/data/clip-shares.json"
import { gameClips, type Clip } from "@/lib/clips"
import { cutKey, cutWindow } from "@/lib/clipCuts"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"

// Links to one play, to send around. Each cut clip (clipCuts.ts) gets a short id from its cut key. `npm run cut-clips` also saves a
// picture of the play and lists the clip in src/data/clip-shares.json, and the build turns each entry into a small page at
// clip/<id>.html (vite.config.ts) with the title and picture a group chat shows, which sends the visitor on to the clip on the site.
// A clip not in the list still has a link, straight to the site, just without the preview.

export interface Share {
  key: string // the cut key
  title: string // "Dunk, Ben"
  poster: string // the picture's path in the video bucket
}

const table = shares as Record<string, Share>

// FNV-1a: a short id that is the same every time for the same clip (and the same in scripts/cut-clips.mjs, which gets it from here).
export function clipId(key: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

export const clipIdOf = (state: PooleanState, c: Clip): string | null => {
  const g = state.games.find((x) => x.id === c.gameId)
  const url = g ? gameVideoUrl(state, g) : ""
  return isDirectVideoUrl(url) ? clipId(cutKey(url, cutWindow(c))) : null
}

// The clip a link names, searched for among every game's clips.
export function clipById(state: PooleanState, id: string): Clip | null {
  for (const g of state.games) for (const c of gameClips(state, g)) if (clipIdOf(state, c) === id) return c
  return null
}

// The link to send: its preview page when the clip has one, else the site's own page for it.
export function shareLink(id: string): string {
  const base = `${location.origin}${import.meta.env.BASE_URL}`
  return table[id] ? `${base}clip/${id}.html` : `${base}#/games/clip/${id}`
}
