import { useEffect } from "react"
import { useReadOnly } from "@/lib/mode"
import type { Update } from "@/lib/store"
import custom from "@/data/custom-headlines.json"
import type { PooleanState } from "@/lib/types"

// Headlines can use private player labels, but visitors never get the labels. So when the editor looks at a story
// list, the finished lines are saved with the league data, and visitors read those saved lines instead of writing
// their own. If nothing has been saved yet, visitors fall back to the generic lines they can write themselves.
export type StoryKey = "going" | "season" | "preview"

// Headlines written by hand and saved with the site, rewritten on request. They show for everyone in place of the template lines.
// A night's lines never go stale; the going-in and season lists step aside once newer games are filmed, until they are rewritten.
const CUSTOM = custom as { writtenAt: string; filmedGames: number; going?: string[]; season?: string[]; preview?: string[]; nights?: Record<string, { quick: string[]; full: string[] }> }
const filmed = (state: PooleanState) => state.games.filter((g) => !g.liveInProgress && g.scoringEvents.length > 0).length
export function customStories(state: PooleanState, key: StoryKey): string[] | null {
  const lines = CUSTOM[key]
  return lines && lines.length && filmed(state) <= CUSTOM.filmedGames ? lines : null
}
export const customNight = (date: string) => CUSTOM.nights?.[date] ?? null

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function usePublishedStories(state: PooleanState, update: Update | undefined, key: StoryKey, computed: string[]): string[] {
  const readOnly = useReadOnly()
  const saved = state.publishedStories?.[key]
  useEffect(() => {
    if (readOnly || !update || same(saved, computed)) return
    update((s) => ({ ...s, publishedStories: { ...s.publishedStories, [key]: computed } }))
  }, [readOnly, update, saved, computed, key])
  return customStories(state, key) ?? (readOnly ? (saved && saved.length ? saved : computed) : computed)
}

export function usePublishedNight(state: PooleanState, update: Update | undefined, date: string, computed: { quick: string[]; full: string[] }): { quick: string[]; full: string[] } {
  const readOnly = useReadOnly()
  const saved = state.publishedStories?.nights?.[date]
  useEffect(() => {
    if (readOnly || !update || !date || same(saved, computed)) return
    update((s) => ({ ...s, publishedStories: { ...s.publishedStories, nights: { ...s.publishedStories?.nights, [date]: computed } } }))
  }, [readOnly, update, date, saved, computed])
  return customNight(date) ?? (readOnly && saved ? saved : computed)
}
