import { CalendarClock } from "lucide-react"
import { useMemo } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { StoryList } from "@/components/StoryList"
import { formatDateDisplay } from "@/lib/format"
import { useLabeledState } from "@/lib/labelsContext"
import { bestSplit, previewStoriesFor, upcomingRsvp } from "@/lib/nightPreview"
import { playerName } from "@/lib/players"
import { usePublishedStories } from "@/lib/published"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

// The next night people have signed up for: who is coming, a few stories about that exact group, and the most even
// split the balancer can find. Shown to everyone; the editor's saved version of the stories is what friends read.
export function NightPreviewCard({ state, update }: { state: PooleanState; update?: Update }) {
  const rsvp = upcomingRsvp(state)
  const labeled = useLabeledState(state)
  const coming = rsvp?.playerIds ?? []
  const written = useMemo(() => (rsvp ? previewStoriesFor(labeled, coming, (id) => playerName(state, id)) : []), [labeled, state, rsvp, coming])
  const stories = usePublishedStories(state, update, "preview", written)
  const split = useMemo(() => (rsvp ? bestSplit(state, coming) : null), [state, rsvp, coming])
  if (!rsvp) return null
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Next night">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <CalendarClock aria-hidden className="size-4 text-accent" /> {formatDateDisplay(rsvp.date)}: {coming.length} coming
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {coming.map((id) => (
          <span key={id} className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-sm">
            <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
            {playerName(state, id)}
          </span>
        ))}
      </div>
      {stories.length > 0 && <StoryList stories={stories} />}
      {split && (
        <p className="text-sm">
          <span className="font-semibold">Even split: </span>
          {names(split.teamA)} vs {names(split.teamB)}
          {split.pA !== null && ` (${Math.round(split.pA * 100)}% for the first side)`}
          {split.sitting.length > 0 && `. Sitting out: ${names(split.sitting)}`}.
        </p>
      )}
    </section>
  )
}
