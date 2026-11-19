import { Pause, Play } from "lucide-react"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { frameStyle, readFrame, type Frame } from "@/lib/stillCache"
import { gameVideoUrl } from "@/lib/video"
import type { Game, PooleanState } from "@/lib/types"

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`

// The clip as it will look: the recording with the crop applied, and a scrubber to find the moment. "Start here" and "End here" take the
// time the picture is showing. "Play the cut" plays just that stretch. A still has no cut, only a frame to find.
export function CutPreview({ state, game, time, frame, from, to, still, onFrom, onTo, onTime, onStillFrom }: { state: PooleanState; game: Game; time: number; frame?: Frame; from: number; to: number; still: boolean; onFrom: (t: number) => void; onTo: (t: number) => void; onTime?: (t: number) => void; onStillFrom?: (t: number) => void }) {
  const url = gameVideoUrl(state, game).split("#")[0]
  const v = useRef<HTMLVideoElement>(null)
  const [now, setNow] = useState(still ? time : from)
  const [playing, setPlaying] = useState(false)
  const lo = Math.max(0, (still ? time : from) - 10), hi = (still ? time : to) + 10
  const seek = (t: number) => { if (v.current) v.current.currentTime = t; setNow(t) }
  const playCut = () => {
    const el = v.current
    if (!el) return
    el.currentTime = from
    void el.play().catch(() => {})
  }
  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <video
          ref={v}
          src={`${url}#t=${still ? time : from}`}
          muted
          playsInline
          preload="auto"
          style={frameStyle(frame ?? readFrame(url))}
          className="size-full object-cover"
          onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; setNow(t); if (!still && !e.currentTarget.paused && t >= to) e.currentTarget.pause() }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>
      <div className="flex items-center gap-2 text-xs tabular-nums">
        <button type="button" aria-label={playing ? "Pause" : "Play"} className="grid size-8 shrink-0 place-items-center rounded-full border" onClick={() => (playing ? v.current?.pause() : void v.current?.play().catch(() => {}))}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input type="range" aria-label="Find the moment" min={lo} max={hi} step={0.1} value={Math.min(Math.max(now, lo), hi)} onChange={(e) => seek(Number(e.target.value))} className="min-w-0 flex-1" />
        <span className="w-12 shrink-0 text-right">{fmt(now)}</span>
      </div>
      {still ? (
        <Button size="sm" variant="outline" className="self-start" onClick={() => onTime?.(now)}>Use this frame</Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button size="sm" variant="outline" onClick={() => onFrom(Math.min(now, to - 0.5))}>Start here</Button>
            <Button size="sm" variant="outline" onClick={() => onTo(Math.max(now, from + 0.5))}>End here</Button>
            <Button size="sm" onClick={playCut}>Play the cut</Button>
            {onStillFrom && <Button size="sm" variant="outline" onClick={() => onStillFrom(now)}>Make a still from this frame</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Starts at {fmt(from)}, ends at {fmt(to)} ({(to - from).toFixed(1)} seconds). The play itself is at {fmt(time)}.</p>
        </>
      )}
    </div>
  )
}
