import { Check, Film, Play, Share2, Smartphone } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import { InlineClip } from "@/components/InlineClip"
import { ClipBackdrop } from "@/components/ClipBackdrop"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { Clip } from "@/lib/clips"
import { clipSource } from "@/lib/clipCuts"
import { clipIdOf, posterOf, shareLink, verticalOf } from "@/lib/clipShare"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"

const LEAD = 5 // seconds of run-up before the play, as the game page's Watch buttons

// One play from a game. At rest the play loops silently (ClipBackdrop, like the profile header: only while on screen, two at most at once,
// held still with Reduce Motion or Data Saver), over the play's saved picture until the video is in; the clip is downloaded only when it
// is going to play. A tap plays it with sound and controls from a few seconds before, stopping any other.
export function ClipTile({ state, clip, className, caption = true }: { state: PooleanState; clip: Clip; className?: string; caption?: boolean }) {
  const game = state.games.find((g) => g.id === clip.gameId)
  const url = game ? gameVideoUrl(state, game) : ""
  const file = isDirectVideoUrl(url)
  const source = clipSource(url, clip) // the clip's short cut when there is one (recording time = cut time + offset)
  const offset = source.offset
  const video = useRef<HTMLVideoElement>(null)
  const poster = useMemo(() => posterOf(state, clip), [state, clip])
  const [playing, setPlaying] = useState(false)
  if (!game || !url) return null
  // Plays straight from the tap (an iPhone only allows sound when play starts inside the tap itself), from a few seconds before the play:
  // the start is part of the address (#t=), so nothing has to wait for the file first.
  const play = () => {
    const v = video.current
    setPlaying(true)
    if (!v) return
    document.querySelectorAll("video").forEach((o) => o !== v && o.pause())
    const from = Math.max(0, (clip.from ?? clip.time - LEAD) - offset)
    v.controls = true
    v.muted = false
    v.preload = "auto"
    if (!v.getAttribute("src")) v.src = `${source.src}#t=${from}`
    else v.currentTime = from
    if (clip.to !== undefined) v.addEventListener("timeupdate", () => v.currentTime >= clip.to! - offset && v.pause()) // stop where the editor cut it
    void v.play().catch(() => {})
  }
  const name = playerName(state, clip.playerId)
  // A link to this play, for any clip that is not rough on someone (those are only shown with that news, never passed around).
  const id = clip.rough?.length ? null : clipIdOf(state, clip)
  return (
    <figure className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-muted">
        {playing && !file ? (
          <InlineClip state={state} game={game} time={clip.time} />
        ) : file ? (
          <>
            {!playing && <ClipBackdrop state={state} clip={clip} scrim="" poster={poster} className="absolute inset-0" />}
            {/* The tile's own player, for a tap: whole picture, sound and controls. Hidden and empty until then. */}
            <video ref={video} muted playsInline preload="none" className={playing ? "size-full object-cover" : "hidden"} aria-label={`${clip.label}, ${name}`} />
          </>
        ) : null}
        {!playing && (
          <button type="button" onClick={file ? play : () => setPlaying(true)} className="absolute inset-0 grid place-items-center bg-black/10 text-white transition-colors hover:bg-black/25 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-primary" aria-label={`Play: ${clip.label}, ${name}`}>
            <span className="grid size-12 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
          </button>
        )}
      </div>
      {caption && (
        <figcaption className="flex min-w-0 items-center gap-2 text-sm">
          <PlayerAvatar id={clip.playerId} name={name} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{clip.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{name}, {formatDateDisplay(clip.date)}</span>
          </span>
          {id && verticalOf(id) && <VerticalClip url={verticalOf(id)!} title={`${clip.label}, ${name}`} />}
          {id && <ShareClip id={id} title={`${clip.label}, ${name}`} />}
        </figcaption>
      )}
    </figure>
  )
}

// Sends the link to a play: the phone's share sheet where there is one, else the link is copied.
function ShareClip({ id, title }: { id: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = shareLink(id)
    try {
      if (navigator.share) return await navigator.share({ title, url })
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* closed the share sheet, or copying was refused */
    }
  }
  return (
    <button type="button" onClick={() => void share()} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={copied ? "Link copied" : `Share this play: ${title}`} title={copied ? "Link copied" : "Share this play"}>
      {copied ? <Check aria-hidden className="size-4" /> : <Share2 aria-hidden className="size-4" />}
    </button>
  )
}

// The play as a vertical video (9:16, captioned, with sound) for an Instagram story or reel: handed to the phone's share sheet as a file
// where it can take one (iPhone, Android), else saved as a download.
function VerticalClip({ url, title }: { url: string; title: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const save = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const blob = await (await fetch(url)).blob()
      const name = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "play"}.mp4`
      const file = new File([blob], name, { type: "video/mp4" })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title })
      } else {
        const a = document.createElement("a")
        a.href = URL.createObjectURL(blob)
        a.download = name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setFailed(true)
    }
    setBusy(false)
  }
  const label = failed ? "That did not work. Try again" : busy ? "Getting the video" : `Vertical video for Instagram: ${title}`
  return (
    <button type="button" disabled={busy} onClick={() => void save()} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60" aria-label={label} title={failed ? "That did not work. Try again" : "Vertical video for Instagram"}>
      <Smartphone aria-hidden className={cn("size-4", busy && "motion-safe:animate-pulse")} />
    </button>
  )
}

// A small film button that opens a clip in a dialog, for places with no room for a tile (the ticker, a headline line).
export function ClipButton({ state, clip, label = "Watch the play", compact = false }: { state: PooleanState; clip: Clip; label?: string; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={cn("inline-grid shrink-0 place-items-center align-middle text-primary", compact ? "-my-1 ml-1 size-6" : "size-9")} aria-label={label} title={label} />}>
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
