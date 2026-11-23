import { Eye, Repeat, Trash2 } from "lucide-react"
import { useEffect, useRef, useState, type MutableRefObject } from "react"
import type { PlayerControl } from "@/components/YouTubePlayer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { playerName } from "@/lib/players"
import { AFTER, BEFORE, reviewTime, updateReview } from "@/lib/reviews"
import { formatVideoTime } from "@/lib/stats"
import type { Update } from "@/lib/store"
import type { Game, PooleanState, Review } from "@/lib/types"
import { cn } from "@/lib/utils"

const SPEEDS = [1, 0.5, 0.25] as const
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })

// The moments flagged with "Review that" during the game. Each plays from a few seconds before the tap, on a loop and at the chosen
// speed, so the group can settle it; the editor records the verdict. A moment shows up here once the recording's start time is known
// (or the editor sets it by hand from the video).
export function ReviewsCard({ state, game, update, readOnly, control, hasVideo, scrollToVideo }: { state: PooleanState; game: Game; update: Update; readOnly: boolean; control: MutableRefObject<PlayerControl | null>; hasVideo: boolean; scrollToVideo: () => void }) {
  const reviews = [...(game.reviews ?? [])].sort((a, b) => a.at - b.at)
  const [playing, setPlaying] = useState<string | null>(null)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const loop = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  useEffect(() => () => clearInterval(loop.current), [])
  if (reviews.length === 0) return null

  const stop = () => {
    clearInterval(loop.current)
    control.current?.rate?.(1)
    control.current?.pause()
    setPlaying(null)
  }
  // From a few seconds before the tap to just after, over and over, at the chosen speed, until stopped or another is played.
  const watch = (r: Review, t: number, rate = speed) => {
    clearInterval(loop.current)
    scrollToVideo()
    const from = Math.max(0, t - BEFORE), to = t + AFTER
    control.current?.rate?.(rate)
    control.current?.seek(from)
    setPlaying(r.id)
    const started = Date.now()
    loop.current = setInterval(() => {
      const now = control.current?.time()
      if (now === undefined || Date.now() - started < 800) return
      if (now >= to || now < from - 1) control.current?.seek(from)
    }, 200)
  }
  const set = (id: string, patch: Partial<Review> | null) => update((s) => updateReview(s, game.id, id, patch))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Eye aria-hidden className="size-4 text-accent" /> Reviews
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Replay speed">
          <span className="text-muted-foreground">Speed</span>
          {SPEEDS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={speed === s ? "secondary" : "outline"}
              aria-pressed={speed === s}
              onClick={() => {
                setSpeed(s)
                control.current?.rate?.(s)
              }}
            >
              {s === 1 ? "Normal" : `${s}x`}
            </Button>
          ))}
          {playing && (
            <Button size="sm" variant="ghost" onClick={stop}>
              Stop
            </Button>
          )}
        </div>
        <ul className="flex flex-col gap-2">
          {reviews.map((r) => {
            const t = reviewTime(state, game, r)
            return (
              <li key={r.id} className={cn("flex flex-col gap-2 rounded-lg border p-3", playing === r.id && "border-primary")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{r.note || "A moment flagged for review"}</span>
                  {r.verdict && <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", r.verdict === "stands" ? "bg-muted" : "bg-primary text-primary-foreground")}>{r.verdict === "stands" ? "Call stands" : "Overturned"}</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Flagged at {clock(r.at)}{r.by ? ` by ${playerName(state, r.by)}` : ""}
                  {t !== null ? `, ${formatVideoTime(t)} into the video` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {t !== null && hasVideo ? (
                    <Button size="sm" onClick={() => watch(r, t)}>
                      <Repeat aria-hidden /> {playing === r.id ? "Replaying" : "Watch it again"}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {hasVideo ? "The recording's start time is not known, so this moment is not placed yet." : "Ready to watch once the recording is uploaded."}
                    </span>
                  )}
                  {!readOnly && hasVideo && t === null && (
                    <Button size="sm" variant="outline" onClick={() => set(r.id, { videoTime: Math.round((control.current?.time() ?? 0) * 10) / 10 })}>
                      It is where the video is now
                    </Button>
                  )}
                  {!readOnly && (
                    <>
                      <Button size="sm" variant={r.verdict === "stands" ? "secondary" : "outline"} aria-pressed={r.verdict === "stands"} onClick={() => set(r.id, { verdict: r.verdict === "stands" ? undefined : "stands" })}>
                        Call stands
                      </Button>
                      <Button size="sm" variant={r.verdict === "overturned" ? "secondary" : "outline"} aria-pressed={r.verdict === "overturned"} onClick={() => set(r.id, { verdict: r.verdict === "overturned" ? undefined : "overturned" })}>
                        Overturned
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Remove this review" onClick={() => set(r.id, null)}>
                        <Trash2 aria-hidden />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
