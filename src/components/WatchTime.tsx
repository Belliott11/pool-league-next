import { Play } from "lucide-react"
import { createContext, useContext } from "react"
import { formatVideoTime } from "@/lib/stats"

// Set by the game page when the game has a video: jumps the video to a time (seconds) and plays it.
export const WatchContext = createContext<((t: number) => void) | null>(null)

// A time in a log. With a video it is a button that plays the video from just before that moment.
export function WatchTime({ t }: { t: number | null | undefined }) {
  const watch = useContext(WatchContext)
  const label = formatVideoTime(t)
  if (!watch || t === null || t === undefined) return <>{label}</>
  return (
    <button type="button" onClick={() => watch(t)} className="inline-flex min-h-8 items-center gap-1 rounded text-primary underline-offset-2 hover:underline" aria-label={`Watch from ${label}`}>
      <Play aria-hidden className="size-3 fill-current" />
      {label}
    </button>
  )
}
