import { defaultFilters } from "@/lib/filters"

export interface Toggles {
  imbalanced: boolean
  pastSeasons: boolean
  outliers: boolean
  // Only count games played under the current rulebook (rulebook.ts). Off by default; offered once the rules have changed.
  currentRules?: boolean
}

// What is saved on this phone. `outliers` is left out while it matches the default, so the default can move (see OUTLIERS_OFF_AT in
// filters.ts) for everyone who has not chosen.
export interface StoredToggles {
  imbalanced: boolean
  pastSeasons: boolean
  outliers?: boolean
  currentRules?: boolean
  v?: 2
}

export const DEFAULT_TOGGLES: Toggles = { imbalanced: false, pastSeasons: false, outliers: true }
export const defaultToggles = (): Toggles => ({ imbalanced: false, pastSeasons: false, outliers: defaultFilters().outliers })

const TOGGLES_KEY = "pooleanIntelToggles"

export function loadStoredToggles(): StoredToggles {
  try {
    const saved = JSON.parse(localStorage.getItem(TOGGLES_KEY) || "{}") as Partial<StoredToggles>
    // Saves from before the default could move always held outliers; true was simply the old default, so it becomes automatic.
    const outliers = saved.v === 2 ? saved.outliers : saved.outliers === false ? false : undefined
    return { imbalanced: !!saved.imbalanced, pastSeasons: !!saved.pastSeasons, ...(outliers === undefined ? {} : { outliers }), ...(saved.currentRules ? { currentRules: true } : {}), v: 2 }
  } catch {
    return { imbalanced: false, pastSeasons: false, v: 2 }
  }
}

export const resolveToggles = (s: StoredToggles): Toggles => ({ imbalanced: s.imbalanced, pastSeasons: s.pastSeasons, outliers: s.outliers ?? defaultFilters().outliers, ...(s.currentRules ? { currentRules: true } : {}) })

// Saves a choice from the Filters menu. An outliers setting equal to the default is stored as automatic.
export function storeToggles(t: Toggles): StoredToggles {
  const s: StoredToggles = { imbalanced: t.imbalanced, pastSeasons: t.pastSeasons, ...(t.outliers === defaultFilters().outliers ? {} : { outliers: t.outliers }), ...(t.currentRules ? { currentRules: true } : {}), v: 2 }
  try {
    localStorage.setItem(TOGGLES_KEY, JSON.stringify(s))
  } catch {
    // Private browsing: the choice lasts for this visit only.
  }
  return s
}

// Kept for older callers and tests.
export function loadToggles(): Toggles {
  return resolveToggles(loadStoredToggles())
}
