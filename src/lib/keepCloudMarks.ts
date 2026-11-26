import type { PooleanState } from "./types"

// When this device's copy replaces the cloud's (the "Overwrite the cloud with mine" button, or a save during a live game that
// takes a friend's baskets), marks made elsewhere would be lost if this copy is older: clip reviews done on another phone or
// tab, and instant replay flags friends sent in. Those are kept: any clip review (by key) or replay flag (by id) the cloud
// has and this copy lacks is added back. This copy's own version wins wherever both have one.
// (2026-11-26: an older copy wiped 11 clip reviews made the night before.)
export function keepCloudMarks(local: PooleanState, cloud: PooleanState | null | undefined): PooleanState {
  if (!cloud) return local
  const byId = new Map(cloud.games.map((g) => [g.id, g]))
  let changed = false
  const games = local.games.map((g) => {
    const c = byId.get(g.id)
    if (!c) return g
    const mineKeys = new Set((g.clipReviews ?? []).map((r) => r.key))
    const addReviews = (c.clipReviews ?? []).filter((r) => !mineKeys.has(r.key))
    const mineIds = new Set((g.reviews ?? []).map((r) => r.id))
    const addFlags = (c.reviews ?? []).filter((r) => !mineIds.has(r.id))
    if (!addReviews.length && !addFlags.length) return g
    changed = true
    return {
      ...g,
      ...(addReviews.length ? { clipReviews: [...(g.clipReviews ?? []), ...addReviews] } : {}),
      ...(addFlags.length ? { reviews: [...(g.reviews ?? []), ...addFlags] } : {}),
    }
  })
  return changed ? { ...local, games } : local
}
