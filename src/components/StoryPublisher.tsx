import { useEffect, useMemo } from "react"
import { gameDays, summarizeNight } from "@/lib/nightRecap"
import { predictRealMatchup } from "@/lib/matchup"
import { nightCallouts } from "@/lib/records"
import { nightStories, previewStories, seasonStories } from "@/lib/storylines"
import { useLabeledState } from "@/lib/labelsContext"
import { playerName } from "@/lib/players"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

const RECENT_NIGHTS = 8

// For the editor: keeps the saved headlines up to date for recent nights, the going-in card and the season card, so
// friends see them without the editor having to open each recap. Runs after the data settles for a moment, and only
// writes when something changed. Visitors never run this; they read what was saved.
export function StoryPublisher({ state, update }: { state: PooleanState; update: Update }) {
  const labeled = useLabeledState(state)
  const written = useMemo(() => {
    const nm = (id: string) => playerName(state, id)
    const predict = (a: string[], b: string[]) => predictRealMatchup(a, b)
    const nights: Record<string, { quick: string[]; full: string[] }> = {}
    for (const date of gameDays(state).slice(0, RECENT_NIGHTS)) {
      const full = summarizeNight(state, date)
      const callouts = nightCallouts(state, date)
      nights[date] = {
        quick: nightStories(labeled, { ...full, mvp: null }, callouts.filter((c) => c.key === "pts"), nm, predict),
        full: nightStories(labeled, full, callouts, nm, predict),
      }
    }
    return { nights, going: previewStories(labeled, nm), season: seasonStories(labeled, nm) }
  }, [labeled, state])

  useEffect(() => {
    const saved = state.publishedStories
    const merged = { ...saved, nights: { ...saved?.nights, ...written.nights }, going: written.going, season: written.season }
    if (JSON.stringify(saved ?? null) === JSON.stringify(merged)) return
    // Wait for a quiet moment so a night of live scoring is one save, not one per basket.
    const t = setTimeout(() => update((s) => ({ ...s, publishedStories: { ...s.publishedStories, nights: { ...s.publishedStories?.nights, ...written.nights }, going: written.going, season: written.season } })), 1500)
    return () => clearTimeout(t)
  }, [written, state.publishedStories, update])

  return null
}
