import type { Clip } from "@/lib/clips"
import { formatDateDisplay } from "@/lib/format"
import { headlineClip } from "@/lib/headlineClips"
import { customNight, customStories } from "@/lib/published"
import type { PooleanState } from "@/lib/types"

export interface TickerItem {
  tag: string
  text: string
  clip?: Clip // a play from that night, for items about the night
}

// The headlines for the scrolling bar: the latest night, then what is coming, then the season. It only reads lines that are
// already written (by hand, or saved by the editor), so visitors and the editor see the same bar.
export function tickerItems(state: PooleanState): TickerItem[] {
  const last = state.games
    .filter((g) => !g.liveInProgress && g.date)
    .map((g) => g.date)
    .sort()
    .at(-1)
  const night = last ? (customNight(last) ?? state.publishedStories?.nights?.[last]) : null
  const list = (key: "going" | "season") => customStories(state, key) ?? state.publishedStories?.[key] ?? []
  const used = new Set<string>() // no clip is used for two headlines
  const nightIds = state.games.filter((g) => g.date === last).map((g) => g.id)
  return [
    ...(night?.quick.length ? night.quick : (night?.full ?? [])).map((text) => ({ tag: formatDateDisplay(last), text, clip: headlineClip(state, text, nightIds, undefined, used) })),
    ...list("going").map((text) => ({ tag: "Up next", text, clip: headlineClip(state, text, undefined, undefined, used) })),
    ...list("season").map((text) => ({ tag: "Season", text, clip: headlineClip(state, text, undefined, undefined, used) })),
  ]
}
