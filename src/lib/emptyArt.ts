import { bestClips, type Clip } from "@/lib/clips"
import type { PooleanState } from "@/lib/types"

// A still from a good play behind a mostly empty panel. The app hands over its state once per change; a panel picks one by its title, so the
// same panel always gets the same frame and neighbors differ. Editor-marked highlights come first, one per game for variety.
let art: { state: PooleanState; clips: Clip[] } | null = null
let last: PooleanState | null = null

export function setArt(state: PooleanState) {
  if (state === last) return
  last = state
  // The plays that look like moments: dunks, shots on someone (blocks, beating a defender), and marked highlights, which are where the
  // celebrations are. Falls back to anything with a recording when a league has none of those yet.
  const show = bestClips(state, { limit: 6, perGame: 1, kinds: ["marked", "winner", "dunk", "contested", "block", "beat"] })
  const clips = show.length ? show : bestClips(state, { limit: 6, perGame: 1 })
  art = clips.length ? { state, clips } : null
}

export function artFor(title: string): { state: PooleanState; clip: Clip } | null {
  if (!art) return null
  let h = 0
  for (const ch of title) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { state: art.state, clip: art.clips[h % art.clips.length] }
}
