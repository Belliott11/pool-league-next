import { useEffect, useRef, useState, type ReactNode } from "react"
import type { Clip } from "@/lib/clips"
import { preconnect } from "@/lib/mediaGate"
import { frameStyle, loadWithStill, readFrame, readStill, stillKey } from "@/lib/stillCache"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"

const BEFORE = 3 // seconds of run-up shown before the play
const AFTER = 6 // and after it, then the clip loops

// How many seconds one pass of a backdrop lasts.
export const clipSpan = (c: Clip) => (c.to ?? c.time + AFTER) - Math.max(0, c.from ?? c.time - BEFORE)
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
export function ClipBackdrop({ state, clip, className, scrim = "bg-background/65", cellularOk = false, still = false, children }: { state: PooleanState; clip: Clip; className?: string; scrim?: string; cellularOk?: boolean; still?: boolean; children?: ReactNode }) {
  const game = state.games.find((g) => g.id === clip.gameId)
  const url = game ? gameVideoUrl(state, game) : ""
  const file = isDirectVideoUrl(url)
  const box = useRef<HTMLDivElement>(null)
  const saved = file ? readStill(stillKey(url, Math.max(0, clip.from ?? clip.time - BEFORE))) : null // the frame from a past visit, shown while the video loads
  const video = useRef<HTMLVideoElement>(null)
  const [frame, setFrame] = useState(() => (file ? readFrame(url) : null)) // crop onto the pool
  const start = Math.max(0, clip.from ?? clip.time - BEFORE)
  const end = clip.to ?? clip.time + AFTER
  useEffect(() => {
    const el = box.current
    const v = video.current
    if (!el || !v || !file) return
    const saver = (navigator as Navigator & { connection?: Conn }).connection?.saveData === true
    const calm = still || clip.kind === "still" || matchMedia("(prefers-reduced-motion: reduce)").matches || saver // `still`: hold the frame, never play
    let visible = false
    const sync = () => {
      if (visible && !document.hidden && !calm && (cellularOk || !onMobileData()) && (playing.has(v) || [...playing].filter((o) => !o.paused).length < MAX_PLAYING)) {
        playing.add(v)
        void v.play().catch(() => playing.delete(v))
      } else {
        v.pause()
        playing.delete(v)
      }
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !v.getAttribute("src")) {
        preconnect(url)
        loadWithStill(v, `${url.split("#")[0]}#t=${start}`, stillKey(url, start), start, () => setFrame(readFrame(url)))
      }
      sync()
    }, { threshold: 0.25 })
    io.observe(el)
    document.addEventListener("visibilitychange", sync)
    const loop = () => {
      if (v.currentTime >= end || v.currentTime < start - 0.5) v.currentTime = start
    }
    v.addEventListener("timeupdate", loop)
    return () => {
      io.disconnect()
      document.removeEventListener("visibilitychange", sync)
      v.removeEventListener("timeupdate", loop)
      v.pause()
      playing.delete(v)
    }
  }, [url, file, start, end, cellularOk, still])
  return (
    <div ref={box} className={cn("relative overflow-hidden", className)}>
      {file && (
        <>
          {saved && <img src={saved} alt="" aria-hidden style={frameStyle(clip.frame ?? frame)} className="pointer-events-none absolute inset-0 size-full object-cover" />}
          <video ref={video} style={frameStyle(clip.frame ?? frame)} muted loop={false} playsInline preload="none" aria-hidden tabIndex={-1} className="pointer-events-none absolute inset-0 size-full object-cover" />
          <div aria-hidden className={cn("pointer-events-none absolute inset-0", scrim)} />
        </>
      )}
      {children && <div className="relative">{children}</div>}
    </div>
  )
}
