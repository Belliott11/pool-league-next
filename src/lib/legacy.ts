// Bridge between the new app's React state and the extracted classic-site compute layer
// (legacy-core.ts, generated from dashboard/app.js). That module keeps its own copy of the state in
// module scope, so it has to be told whenever the state or a toggle changes.
import { normalizeLegacyState, setLegacyState, setLegacyToggles } from "./legacy-core"
import type { Toggles } from "./toggles"
import type { PooleanState } from "./types"

// Normalizes a deep copy (the legacy normalizer fills in missing fields in place) so React state
// is never mutated.
export function syncLegacy(state: PooleanState, toggles: Toggles) {
  setLegacyState(normalizeLegacyState(structuredClone(state)))
  setLegacyToggles(toggles)
}
