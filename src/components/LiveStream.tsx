import { Radio, Rewind } from "lucide-react"
import type { MutableRefObject } from "react"
import { Button } from "@/components/ui/button"
import { YouTubePlayer, type PlayerControl } from "@/components/YouTubePlayer"
import { youtubeId } from "@/lib/video"

// The game's live stream (an unlisted YouTube live), with instant replay: jump back 10 or 30 seconds, then back to live. Everyone watching
// on their own phone can replay without stopping the game. `control` is shared so "Review that" can note where the stream was.
export function LiveStream({ url, control }: { url: string; control: MutableRefObject<PlayerControl | null> }) {
  const id = youtubeId(url)
  if (!id)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
        Watch the stream
      </a>
    )
  const back = (s: number) => {
    const c = control.current
    if (c) c.seek(Math.max(0, c.time() - s))
  }
  return (
    <div className="flex flex-col gap-2">
      <YouTubePlayer id={id} control={control} />
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Instant replay">
        <Button variant="outline" className="h-11" onClick={() => back(10)}>
          <Rewind aria-hidden /> 10s
        </Button>
        <Button variant="outline" className="h-11" onClick={() => back(30)}>
          <Rewind aria-hidden /> 30s
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            const c = control.current
            if (c?.duration) c.seek(c.duration())
          }}
        >
          <Radio aria-hidden /> Live
        </Button>
      </div>
    </div>
  )
}

// A YouTube link that can be a live stream: watch, live, shorts or youtu.be.
export const isStreamLink = (v: string) => !!youtubeId(v.trim())
