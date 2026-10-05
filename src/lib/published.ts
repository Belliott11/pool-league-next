import { useEffect } from "react"
import { useReadOnly } from "@/lib/mode"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

// Headlines can use private player labels, but visitors never get the labels. So when the editor looks at a story
// list, the finished lines are saved with the league data, and visitors read those saved lines instead of writing
// their own. If nothing has been saved yet, visitors fall back to the generic lines they can write themselves.
export type StoryKey = "going" | "season"

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function usePublishedStories(state: PooleanState, update: Update | undefined, key: StoryKey, computed: string[]): string[] {
  const readOnly = useReadOnly()
  const saved = state.publishedStories?.[key]
  useEffect(() => {
    if (readOnly || !update || same(saved, computed)) return
    update((s) => ({ ...s, publishedStories: { ...s.publishedStories, [key]: computed } }))
  }, [readOnly, update, saved, computed, key])
  return readOnly ? (saved && saved.length ? saved : computed) : computed
}

export function usePublishedNight(state: PooleanState, update: Update | undefined, date: string, computed: { quick: string[]; full: string[] }): { quick: string[]; full: string[] } {
  const readOnly = useReadOnly()
  const saved = state.publishedStories?.nights?.[date]
  useEffect(() => {
    if (readOnly || !update || !date || same(saved, computed)) return
    update((s) => ({ ...s, publishedStories: { ...s.publishedStories, nights: { ...s.publishedStories?.nights, [date]: computed } } }))
  }, [readOnly, update, date, saved, computed])
  return readOnly && saved ? saved : computed
}
