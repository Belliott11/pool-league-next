import { useEffect, useRef, useState, type ReactNode } from "react"
import type { Clip } from "@/lib/clips"
import { clipSource } from "@/lib/clipCuts"
import { preconnect } from "@/lib/mediaGate"
import { followPlayback } from "@/lib/track"
import { coverStyle, loadWithStill, readFrame, readStill, stillKey } from "@/lib/stillCache"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"

const BEFORE = 3 // seconds of run-up shown before the play
const AFTER = 6 // and after it, then the clip loops

// How many seconds one pass of a backdrop lasts.
export const clipSpan = (c: Clip) => (c.to ?? c.time + AFTER) - Math.max(0, c.from ?? c.time - BEFORE)
// A backdrop narrower than this is shrunk (a phone, a small window): the crop onto the pool and the follow camera zoom in so the play is not tiny.
// Wider than this the whole picture is large enough as it is.
const SMALL = 640
const MAX_PLAYING = 2 // backdrops playing at once on a page; the rest hold their still frame

const playing = new Set<HTMLVideoElement>()
type Conn = { saveData?: boolean; type?: string; effectiveType?: string }
const onMobileData = () => {
  const c = (navigator as Navigator & { connection?: Conn }).connection
  return c?.type === "cellular" || c?.effectiveType === "slow-2g" || c?.effectiveType === "2g" || c?.effectiveType === "3g"
}

// A play looping silently behind content. It only plays while it is on screen and the tab is showing, never more than two at once,
// and not at all (a still frame instead) with reduced motion or Data Saver on. On mobile data only a backdrop marked `cellularOk` plays (one
// place on the site, Wrapped); the rest wait for Wi-Fi. ponytail: only browsers that report the connection type can tell (Chrome on Android);
// Safari on iPhone says nothing, so there the backdrops play as on Wi-Fi. A scrim keeps whatever sits on top readable.
export function ClipBackdrop({ state, clip, className, scrim = "bg-background/65", cellularOk = false, still = false, contain = false, manual = false, children }: { state: PooleanState; clip: Clip; className?: string; scrim?: string; cellularOk?: boolean; still?: boolean; contain?: boolean; manual?: boolean; children?: ReactNode }) {
  const game = state.games.find((g) => g.id === clip.gameId)
  const url = game ? gameVideoUrl(state, game) : ""
  const file = isDirectVideoUrl(url)
  const source = clipSource(url, clip) // the clip's short cut when there is one; times below are in the recording, less `offset` in the cut
  const offset = source.offset
  const box = useRef<HTMLDivElement>(null)
  const saved = file ? readStill(stillKey(url, Math.max(0, clip.from ?? clip.time - BEFORE))) : null // the frame from a past visit, shown while the video loads
  const video = useRef<HTMLVideoElement>(null)
  const [frame, setFrame] = useState(() => (file ? readFrame(url) : null)) // crop onto the pool
  // Reduced motion or Data Saver holds a backdrop still. With `manual`, a Play button lets the person start it anyway.
  const prefsCalm = typeof matchMedia !== "undefined" && (matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: Conn }).connection?.saveData === true)
  const [forced, setForced] = useState(false)
  const [size, setSize] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1280, h: 0 }) // the box, to lay the crop out for its shape
  const small = size.w < SMALL
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const start = Math.max(0, clip.from ?? clip.time - BEFORE)
  const zoomed = small && !contain // only a shrunk backdrop is zoomed in
  const following = zoomed && !!clip.track?.length
  const staticFrame = following ? { z: clip.frame?.z ?? 2, x: clip.track![0].x, y: clip.track![0].y } : (clip.frame ?? frame) // a followed clip rests on where it starts
  // The picture is laid out at its full cover size (wider than a tall box), centred, and the crop moves that. (Moving a box that has already
  // cropped the picture would show empty space beside it.)
  const lay = zoomed && size.h ? (() => { const s0 = Math.max(size.w / 1280, size.h / 720), Wd = 1280 * s0, Hd = 720 * s0; return { width: Wd, height: Hd, left: (size.w - Wd) / 2, top: (size.h - Hd) / 2 } })() : undefined
  const cover = zoomed ? coverStyle(staticFrame, size.w, size.h) : undefined
  const media = lay ? "pointer-events-none absolute max-w-none" : cn("pointer-events-none absolute inset-0 size-full", contain ? "object-contain" : "object-cover")
  const end = clip.to ?? clip.time + AFTER
  useEffect(() => {
    const v = video.current
    if (!v || !following) return
    return followPlayback(v, clip.track!, clip.frame?.z ?? 2, offset) // the camera follows the ball or player while it plays
  }, [following, clip.track, clip.frame?.z, offset])
  useEffect(() => {
    const el = box.current
    const v = video.current
    if (!el || !v || !file) return
    const saver = (navigator as Navigator & { connection?: Conn }).connection?.saveData === true
    const calm = still || clip.kind === "still" || ((matchMedia("(prefers-reduced-motion: reduce)").matches || saver) && !forced) // `still`: hold the frame, never play
    let visible = false
    const sync = () => {
      if (visible && !document.hidden && !calm && (cellularOk || !onMobileData()) && (playing.has(v) || [...playing].filter((o) => !o.paused).length < MAX_PLAYING)) {
        playing.add(v)
        // iPhones in Low Power Mode refuse to autoplay until the person touches the page; the first touch tries again.
        void v.play().catch(() => (playing.delete(v), document.addEventListener("pointerdown", sync, { once: true })))
      } else {
        v.pause()
        playing.delete(v)
      }
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !v.getAttribute("src")) {
        preconnect(source.src)
        loadWithStill(v, `${source.src}#t=${start - offset}`, stillKey(url, start), start - offset, () => setFrame(readFrame(url)), url)
      }
      sync()
    }, { threshold: 0.25 })
    io.observe(el)
    document.addEventListener("visibilitychange", sync)
    const loop = () => {
      if (v.currentTime >= end - offset || v.currentTime < start - offset - 0.5) v.currentTime = start - offset
    }
    const again = () => ((v.currentTime = start - offset), sync()) // a cut can end before the last timeupdate reaches `end`
    v.addEventListener("timeupdate", loop)
    v.addEventListener("ended", again)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", sync)
      document.removeEventListener("pointerdown", sync)
      v.removeEventListener("timeupdate", loop)
      v.removeEventListener("ended", again)
      v.pause()
      playing.delete(v)
    }
  }, [url, source.src, offset, file, start, end, cellularOk, still, forced])
  return (
    <div ref={box} className={cn("relative overflow-hidden", className)}>
      {file && (
        <>
          {saved && <img src={saved} alt="" aria-hidden style={{ ...lay, ...cover }} className={media} />}
          <video ref={video} style={following ? lay : { ...lay, ...cover }} muted loop={false} playsInline preload="none" aria-hidden tabIndex={-1} className={media} />
          <div aria-hidden className={cn("pointer-events-none absolute inset-0", scrim)} />
          {manual && prefsCalm && !forced && !still && (
            <button type="button" onClick={() => setForced(true)} className="absolute inset-0 z-10 grid place-items-center bg-black/20 text-white" aria-label="Play the clip">
              <span className="grid size-14 place-items-center rounded-full bg-black/60 text-2xl">▶</span>
            </button>
          )}
        </>
      )}
      {children && <div className="relative">{children}</div>}
    </div>
  )
}
