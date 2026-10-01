// Data bridge: this app lives at a different GitHub Pages origin than the old static site, so
// localStorage doesn't carry over automatically. Rather than invent a new export mechanism, the
// first-run flow here just imports the exact JSON the old app's existing "Export All Data" / Save
// Backup already produces (same STORAGE_KEY shape, see dashboard/README.md "Data schema (JSON)").
import type { PooleanState } from "./types"

const STORAGE_KEY = "pooleanIntelState"

export function loadState(): PooleanState | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PooleanState
  } catch {
    return null
  }
}

export function saveState(state: PooleanState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function importStateFromJson(json: string): PooleanState {
  const parsed = JSON.parse(json) as PooleanState
  if (!Array.isArray(parsed.players) || !Array.isArray(parsed.games)) {
    throw new Error("That file doesn't look like a Poolean Intel export (missing players/games).")
  }
  saveState(parsed)
  return parsed
}
