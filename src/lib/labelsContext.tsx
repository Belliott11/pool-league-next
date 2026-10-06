import { createContext, useContext, useMemo } from "react"
import type { LabelBook } from "@/lib/labelStore"
import type { PooleanState } from "@/lib/types"

// The editor's private labels, for the screens that write headlines or let the editor assign them. Visitors get an
// empty book, so nothing label-related ever shows for them.
export interface LabelsApi {
  labels: LabelBook
  setPlayerLabels: (playerId: string, update: (cur: string[]) => string[]) => void
  // Thumbs a finished headline down so it is not written again. Kept in the same private book under HIDDEN.
  hideLine: (text: string) => void
  restoreHidden: () => void
  // Marks a headline wording as approved, removed, or back to unreviewed.
  reviewLine: (text: string, verdict: "ok" | "no" | "clear") => void
}

export const HIDDEN = "__hidden"
export const APPROVED = "__ok"
// Removed lines already sent to Claude for rewriting, so the next copy only has the new ones.
export const SENT = "__sent"

export const LabelsContext = createContext<LabelsApi>({ labels: {}, setPlayerLabels: () => {}, hideLine: () => {}, restoreHidden: () => {}, reviewLine: () => {} })
export const useLabels = () => useContext(LabelsContext)

// The state with the private labels laid over it, for headline writing only. Never saved or shared.
export function useLabeledState(state: PooleanState): PooleanState {
  const { labels } = useLabels()
  return useMemo(() => (Object.keys(labels).length ? { ...state, playerLabels: labels } : state), [state, labels])
}
