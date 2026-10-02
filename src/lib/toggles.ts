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
