// Bridge between the new app's React state and the extracted classic-site compute layer
// (legacy-core.ts, generated from dashboard/app.js). That module keeps its own copy of the state in
// module scope, so it has to be told whenever the state or a toggle changes.
import { normalizeLegacyState, setLegacyState, setHeatmapRenderer, setLegacyToggles, setTrendRenderer } from "./legacy-core"
import { heatmapHtml } from "./heatmapChart"
import { trendChartHtml } from "./trendChart"
import type { Toggles } from "./toggles"
import type { PooleanState } from "./types"

// Normalizes a deep copy (the legacy normalizer fills in missing fields in place) so React state
// is never mutated.
export function syncLegacy(state: PooleanState, toggles: Toggles) {
  setLegacyState(normalizeLegacyState(structuredClone(state)))
  setLegacyToggles(toggles)
}

// The classic trend panels hand their points to this instead of drawing their own chart.
setTrendRenderer(trendChartHtml)
setHeatmapRenderer(heatmapHtml)
