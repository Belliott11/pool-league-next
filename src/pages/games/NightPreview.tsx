import { CalendarClock, Share2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { shareText } from "@/lib/shareText"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { StoryList } from "@/components/StoryList"
import { formatDateDisplay } from "@/lib/format"
import { useLabeledState } from "@/lib/labelsContext"
import { turnout } from "@/lib/attendance"
import { previewStoriesFor, upcomingRsvp } from "@/lib/nightPreview"
import { formatTime } from "@/lib/format"
import { useEvening } from "@/lib/weather"
import { Countdown } from "./Countdown"
import { playerName } from "@/lib/players"
import { usePublishedStories } from "@/lib/published"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

// The next night people have signed up for: who is coming and a few stories about that exact group. (No suggested
// split until the matchup model is more refined.) Shown to everyone; the editor's saved version of the stories is what friends read.
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`

export function NightPreviewCard({ state, update }: { state: PooleanState; update?: Update }) {
  const rsvp = upcomingRsvp(state)
  const labeled = useLabeledState(state)
  const coming = rsvp?.playerIds ?? []
  const written = useMemo(() => (rsvp ? previewStoriesFor(labeled, coming, (id) => playerName(state, id)) : []), [labeled, state, rsvp, coming])
  const stories = usePublishedStories(state, update, "preview", written)
  const t = useMemo(() => turnout(state, coming), [state, coming])
  const weather = useEvening(rsvp?.date, rsvp?.time)
  const [sent, setSent] = useState<string>("")
  if (!rsvp) return null
  // The whole card as text for the group chat: who is coming and the lines about them.
  const forecast = weather ? `${weather.label}, ${weather.tempF}°F, ${weather.rainPct}% rain` : ""
  const message = [`Poolean Intel, ${formatDateDisplay(rsvp.date)}: ${coming.length} coming`, forecast, coming.map((id) => playerName(state, id)).join(", "), "", ...stories.map((x) => `- ${x}`)].join("\n")
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Next night">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <CalendarClock aria-hidden className="size-4 text-accent" /> {formatDateDisplay(rsvp.date)}: {coming.length} coming
      </h3>
      {rsvp && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <Countdown date={rsvp.date} time={rsvp.time} className="font-display text-base font-bold tabular-nums text-accent" />
          {rsvp.time && <span className="text-muted-foreground">{formatTime(rsvp.time)}</span>}
          {weather && (
            <span className="text-muted-foreground">
              Cherry Hill, {hourLabel(weather.from)} to {hourLabel(weather.to)}: {weather.label}, <span className="tabular-nums">{weather.tempF}°F</span>, <span className="tabular-nums">{weather.rainPct}%</span> chance of rain
            </span>
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {coming.map((id) => (
          <span key={id} className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-sm">
            <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
            {playerName(state, id)}
          </span>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {t.teams}.{t.missing.length > 0 && ` Regulars not on the list: ${t.missing.map((id) => playerName(state, id)).join(", ")}.`}
      </p>
      {stories.length > 0 && <StoryList stories={stories} />}
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={async () => {
          setSent(await shareText(message))
          setTimeout(() => setSent(""), 2000)
        }}
      >
        <Share2 aria-hidden /> {sent === "copied" ? "Copied" : sent === "failed" ? "Could not share" : "Share for the group chat"}
      </Button>
    </section>
  )
}
