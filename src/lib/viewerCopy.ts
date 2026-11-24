import type { Remote } from "./cloud"
import type { PooleanState } from "./types"

// The last copy of the shared league data this phone downloaded, kept so the site opens at once (the fresh copy swaps in a moment later)
// and still shows the stats with no signal. It is the public data anyone can read; private labels are never in it. It is kept apart from
// the editor's own copy (state.ts), so it can never be mistaken for unsent edits.
const KEY = "pooleanIntelViewerCopy"

export interface SavedCopy {
  remote: Remote
  savedAt: number // when this phone saved it, ms since 1970
}

export function saveViewerCopy(remote: Remote) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ remote, savedAt: Date.now() } satisfies SavedCopy))
  } catch {
    // Private browsing or a full disk: the site just opens the slow way next time.
  }
}

export function loadViewerCopy(): SavedCopy | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null") as SavedCopy | null
    return c && c.remote?.state?.games && c.remote.state.players ? c : null
  } catch {
    return null
  }
}

// A saved copy is from the past, so a game it shows as live is not live any more as far as this phone knows: leave it out, rather than
// show an old score as if it were happening now. The fresh copy brings it back if it really is still on.
export function withoutLiveGames(state: PooleanState): PooleanState {
  return state.games.some((g) => g.liveInProgress) ? { ...state, games: state.games.filter((g) => !g.liveInProgress) } : state
}
