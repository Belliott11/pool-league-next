// Bridge between the new app's React state and the extracted classic-site compute layer
// (legacy-core.ts, generated from dashboard/app.js). That module keeps its own copy of the state in
// module scope, so it has to be told whenever the state or a toggle changes.
import { normalizeLegacyState, setLegacyState, setLegacyToggles } from "./legacy-core"
import type { PooleanState } from "./types"

export interface Toggles {
  imbalanced: boolean
  pastSeasons: boolean
  outliers: boolean
}

export const DEFAULT_TOGGLES: Toggles = { imbalanced: false, pastSeasons: false, outliers: true }

const TOGGLES_KEY = "pooleanIntelToggles"

export function loadToggles(): Toggles {
  try {
    return { ...DEFAULT_TOGGLES, ...JSON.parse(localStorage.getItem(TOGGLES_KEY) || "{}") }
  } catch {
    return DEFAULT_TOGGLES
  }
}

export function saveToggles(t: Toggles) {
  localStorage.setItem(TOGGLES_KEY, JSON.stringify(t))
}

// Normalizes a deep copy (the legacy normalizer fills in missing fields in place) so React state
// is never mutated.
export function syncLegacy(state: PooleanState, toggles: Toggles) {
  setLegacyState(normalizeLegacyState(structuredClone(state)))
  setLegacyToggles(toggles)
}
