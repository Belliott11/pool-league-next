import { Pause, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { frameStyle, readFrame, type Frame } from "@/lib/stillCache"
import { atTime, followFrom, followPlayback, smooth, sortTrack, type TrackPoint } from "@/lib/track"
import { gameVideoUrl } from "@/lib/video"
import type { Game, PooleanState } from "@/lib/types"

const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`

// The clip as it will look: the recording with the crop applied, and a scrubber to find the moment. "Start here" and "End here" take the
// time the picture is showing. "Play the cut" plays just that stretch. A still has no cut, only a frame to find.
// "Follow" is for a ball or a player: tap it on a frame, then "Follow it on" tracks it forward, and the camera zooms on it and follows
// while the clip plays. Tap again anywhere to correct it.
export function CutPreview({ state, game, time, frame, from, to, still, track, onFrom, onTo, onTime, onTrack, onStillFrom }: { state: PooleanState; game: Game; time: number; frame?: Frame; from: number; to: number; still: boolean; track?: TrackPoint[]; onFrom: (t: number) => void; onTo: (t: number) => void; onTime?: (t: number) => void; onTrack?: (t: TrackPoint[]) => void; onStillFrom?: (t: number) => void }) {
  const url = gameVideoUrl(state, game).split("#")[0]
  const v = useRef<HTMLVideoElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const stop = useRef({ stopped: false })
  const [now, setNow] = useState(still ? time : from)
  const [playing, setPlaying] = useState(false)
  const [cors, setCors] = useState(true) // pixels can be read off the video (needed to follow automatically)
  const [tapping, setTapping] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const lo = Math.max(0, (still ? time : from) - 10), hi = (still ? time : to) + 10
  const path = track ?? []
  const zoom = frame?.z ?? 2
  const seek = (t: number) => { if (v.current) v.current.currentTime = t; setNow(t) }
  const playCut = () => {
    const el = v.current
    if (!el) return
    el.currentTime = from
    void el.play().catch(() => {})
  }
  // While not tapping, the camera follows the path as the clip plays.
  useEffect(() => {
    const el = v.current
    if (!el || tapping || still || !path.length) return
    return followPlayback(el, path, zoom)
  }, [tapping, still, path, zoom, cors])

  // Where a tap lands, as 0..1 of the picture, allowing for the whole frame being shown inside the box.
  const shown = () => {
    const b = box.current!.getBoundingClientRect(), el = v.current!
    const s = Math.min(b.width / el.videoWidth, b.height / el.videoHeight)
    const rw = el.videoWidth * s, rh = el.videoHeight * s
    return { b, ox: (b.width - rw) / 2, oy: (b.height - rh) / 2, rw, rh }
  }
  // One tap does it: the tap marks the ball or player, and it is followed on to the end of the cut automatically. A tap later on corrects it
  // (what was tracked after that point is tracked again). The result plays straight away.
  const run = async (anchor: TrackPoint, base: TrackPoint[]) => {
    const el = v.current
    if (!el || !onTrack) return
    stop.current = { stopped: false }
    el.pause()
    setBusy("Following 0%")
    try {
      const found = await followFrom(el, anchor, to, { signal: stop.current, onPoint: (p) => setBusy(`Following ${Math.round(((p.t - anchor.t) / Math.max(0.1, to - anchor.t)) * 100)}%`) })
      onTrack(smooth(sortTrack([...base, ...found])))
    } catch {
      setBusy("It could not follow on its own here, so tap it again every second or so.")
      setCors(false)
      return
    }
    setBusy(null)
    setTapping(false)
    el.currentTime = from
    void el.play().catch(() => {})
  }
  const tap = (e: React.MouseEvent) => {
    if (!v.current?.videoWidth || !onTrack || busy) return
    const { b, ox, oy, rw, rh } = shown()
    const x = Math.min(1, Math.max(0, (e.clientX - b.left - ox) / rw)), y = Math.min(1, Math.max(0, (e.clientY - b.top - oy) / rh))
    const point = { t: now, x, y }
    const base = sortTrack([...path.filter((p) => p.t < now - 0.05), point])
    onTrack(base)
    if (cors) void run(point, base)
  }
  // Where a point sits on the box, as a percentage, for the dots drawn while tapping.
  const at = (p: { x: number; y: number }) => {
    if (!box.current || !v.current?.videoWidth) return null
    const { b, ox, oy, rw, rh } = shown()
    return { left: ((ox + p.x * rw) / b.width) * 100, top: ((oy + p.y * rh) / b.height) * 100 }
  }
  const here = tapping && path.length ? atTime(path, now) : null
  const dot = here ? at(here) : null
  const trail = tapping ? path.map(at).filter((d): d is { left: number; top: number } => !!d) : []

  return (
    <div className="flex w-full max-w-md flex-col gap-1.5">
      <div ref={box} className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        <video
          key={String(cors)}
          ref={v}
          src={`${url}#t=${still ? time : from}`}
          crossOrigin={cors ? "anonymous" : undefined}
          muted
          playsInline
          preload="metadata"
          style={tapping || path.length ? undefined : frameStyle(frame ?? readFrame(url))}
          className={`size-full ${tapping ? "object-contain bg-black" : "object-cover"}`}
          onError={() => cors && setCors(false)}
          onTimeUpdate={(e) => { const t = e.currentTarget.currentTime; setNow(t); if (!still && !e.currentTarget.paused && t >= to) e.currentTarget.pause() }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {tapping && (
          <button type="button" aria-label="Tap the ball or player" className="absolute inset-0 cursor-crosshair" onClick={tap}>
            {trail.map((d, k) => <span key={k} className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" style={{ left: `${d.left}%`, top: `${d.top}%` }} />)}
            {dot && <span className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-2 ring-black/50" style={{ left: `${dot.left}%`, top: `${dot.top}%` }} />}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs tabular-nums">
        <button type="button" aria-label={playing ? "Pause" : "Play"} className="grid size-8 shrink-0 place-items-center rounded-full border" onClick={() => (playing ? v.current?.pause() : void v.current?.play().catch(() => {}))}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input type="range" aria-label="Find the moment" min={lo} max={hi} step={0.1} value={Math.min(Math.max(now, lo), hi)} onChange={(e) => seek(Number(e.target.value))} className="min-w-0 flex-1" />
        <span className="w-12 shrink-0 text-right">{fmt(now)}</span>
      </div>
      {still ? (
        <Button size="sm" variant="outline" className="self-start" onClick={() => onTime?.(now)}>Set this frame</Button>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button size="sm" variant="outline" onClick={() => onFrom(Math.min(now, to - 0.5))}>Start here</Button>
            <Button size="sm" variant="outline" onClick={() => onTo(Math.max(now, from + 0.5))}>End here</Button>
            <Button size="sm" onClick={playCut}>Play the cut</Button>
            {onStillFrom && <Button size="sm" variant="outline" onClick={() => onStillFrom(now)}>Make a still from this frame</Button>}
          </div>
          <p className="text-xs text-muted-foreground">Starts at {fmt(from)}, ends at {fmt(to)} ({(to - from).toFixed(1)} seconds). The play itself is at {fmt(time)}.</p>
          {onTrack && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Follow a ball or player</span>
                {busy?.startsWith("Following") ? (
                  <Button size="sm" variant="outline" onClick={() => (stop.current.stopped = true)}>Stop</Button>
                ) : tapping ? (
                  <Button size="sm" variant="outline" onClick={() => setTapping(false)}>Cancel</Button>
                ) : (
                  <Button size="sm" onClick={() => { v.current?.pause(); if (!path.length) seek(from); setTapping(true) }}>{path.length ? "Fix it" : "Follow something"}</Button>
                )}
                {path.length > 0 && !busy && !tapping && <button type="button" className="underline text-muted-foreground" onClick={() => onTrack([])}>Clear</button>}
              </div>
              <p className="text-muted-foreground">
                {busy ?? (tapping
                  ? "Scrub to the moment you want, then tap the ball or the player once. It follows from there on its own and plays."
                  : path.length
                    ? `Following. Zoom is ${zoom.toFixed(1)}x (the Zoom slider). Not right? Press Fix it, scrub to where it slipped, and tap it again.`
                    : "Press Follow something, tap the ball or a player, and the picture zooms in and follows them while the clip plays.")}
                {!cors && !busy && " Following on its own needs the video host to allow it, which it does on the live site. Here, tap it every second or so and the picture glides between your taps."}
              </p>
              {tapping && !cors && <Button size="sm" className="self-start" onClick={() => setTapping(false)}>Done tapping</Button>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
