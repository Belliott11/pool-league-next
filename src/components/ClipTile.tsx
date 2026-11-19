import { Film, Play } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { InlineClip } from "@/components/InlineClip"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { Clip } from "@/lib/clips"
import { preconnect } from "@/lib/mediaGate"
import { frameStyle, loadWithStill, readFrame, readStill, stillKey } from "@/lib/stillCache"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"

const LEAD = 5 // seconds of run-up before the play, as the game page's Watch buttons

// One play from a game. At rest it is a still frame of the moment. The first visit loads the frame from the recording (only when the tile
// nears the screen) and keeps it on the device, so after that the tile shows at once and the recording is not touched until a tap plays
// it, from a few seconds before, stopping any other.
export function ClipTile({ state, clip, className, caption = true }: { state: PooleanState; clip: Clip; className?: string; caption?: boolean }) {
  const game = state.games.find((g) => g.id === clip.gameId)
  const url = game ? gameVideoUrl(state, game) : ""
  const file = isDirectVideoUrl(url)
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [near, setNear] = useState(false)
  const key = stillKey(url, clip.time)
  const [still, setStill] = useState<string | null>(() => readStill(key)) // the saved frame, once there is one
  const [frame, setFrame] = useState(() => readFrame(url)) // the crop onto the pool, once a frame has been looked at
  const [shown, setShown] = useState(false) // the recording's own frame is in
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === "undefined") return setNear(true)
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setNear(true), io.disconnect()), { rootMargin: "150px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const v = video.current
    if (!near || !file || !url || still || !v || v.getAttribute("src")) return
    preconnect(url)
    loadWithStill(v, `${url.split("#")[0]}#t=${clip.time}`, key, clip.time, (d) => (setStill(d), setFrame(readFrame(url))))
  }, [near, file, url, still, key, clip.time])
  if (!game || !url) return null
  const play = () => {
    const v = video.current
    setPlaying(true)
    if (!v) return
    document.querySelectorAll("video").forEach((o) => o !== v && o.pause())
    const go = () => {
      v.currentTime = Math.max(0, clip.time - LEAD)
      void v.play().catch(() => {})
    }
    v.controls = true
    v.muted = false
    if (!v.getAttribute("src")) v.src = url.split("#")[0]
    if (v.readyState >= 1) go()
    else v.addEventListener("loadedmetadata", go, { once: true })
  }
  const name = playerName(state, clip.playerId)
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div ref={box} className={cn("relative aspect-video overflow-hidden rounded-xl bg-muted", file && near && !still && !shown && !playing && "motion-safe:animate-pulse")}>
        {playing && !file ? (
          <InlineClip state={state} game={game} time={clip.time} />
        ) : file ? (
          <video
            ref={video}
            onLoadedData={() => setShown(true)}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
            style={playing ? undefined : frameStyle(clip.frame ?? frame)} // zoomed onto the pool at rest; whole picture once playing, so the controls show
            aria-label={`${clip.label}, ${name}`}
          />
        ) : null}
        {still && !playing && <img src={still} alt="" style={frameStyle(clip.frame ?? frame)} className="absolute inset-0 size-full object-cover" />}
        {!playing && (
          <button type="button" onClick={file ? play : () => setPlaying(true)} className="absolute inset-0 grid place-items-center bg-black/25 text-white transition-colors hover:bg-black/35 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary" aria-label={`Play: ${clip.label}, ${name}`}>
            <span className="grid size-12 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
          </button>
        )}
      </div>
      {caption && (
        <figcaption className="flex min-w-0 items-center gap-2 text-sm">
          <PlayerAvatar id={clip.playerId} name={name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{clip.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{name}, {formatDateDisplay(clip.date)}</span>
          </span>
        </figcaption>
      )}
    </figure>
  )
}

// A small film button that opens a clip in a dialog, for places with no room for a tile (the ticker, a headline line).
export function ClipButton({ state, clip, label = "Watch the play", compact = false }: { state: PooleanState; clip: Clip; label?: string; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={cn("inline-grid shrink-0 place-items-center align-middle text-primary", compact ? "-my-0.5 ml-1.5 size-5" : "size-9")} aria-label={label} title={label} />}>
        <Film className={compact ? "size-3.5" : "size-4"} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle>{clip.label}</DialogTitle>
        <ClipTile state={state} clip={clip} />
      </DialogContent>
    </Dialog>
  )
}

// A row of tiles that scrolls sideways on a phone and sits in a grid on a wide screen.
export function ClipStrip({ state, clips }: { state: PooleanState; clips: Clip[] }) {
  if (clips.length === 0) return null
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
      {clips.map((c) => (
        <ClipTile key={`${c.gameId}-${c.time}-${c.playerId}`} state={state} clip={c} className="w-64 shrink-0 snap-start sm:w-auto" />
      ))}
    </div>
  )
}
