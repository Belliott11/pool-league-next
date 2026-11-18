import { useEffect, useRef, type ReactNode } from "react"
import type { Clip } from "@/lib/clips"
import type { PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"

const BEFORE = 2 // seconds of run-up shown before the play
const AFTER = 4 // and after it, then the clip loops
const MAX_PLAYING = 2 // backdrops playing at once on a page; the rest hold their still frame

const playing = new Set<HTMLVideoElement>()

// A play looping silently behind content. It only plays while it is on screen and the tab is showing, never more than two at once,
// and not at all (a still frame instead) with reduced motion or Data Saver on. A scrim keeps whatever sits on top readable.
export function ClipBackdrop({ state, clip, className, scrim = "bg-background/65", children }: { state: PooleanState; clip: Clip; className?: string; scrim?: string; children?: ReactNode }) {
  const game = state.games.find((g) => g.id === clip.gameId)
  const url = game ? gameVideoUrl(state, game) : ""
  const file = isDirectVideoUrl(url)
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const start = Math.max(0, clip.time - BEFORE)
  const end = clip.time + AFTER
  useEffect(() => {
    const el = box.current
    const v = video.current
    if (!el || !v || !file) return
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    let visible = false
    const sync = () => {
      if (visible && !document.hidden && !calm && (playing.has(v) || [...playing].filter((o) => !o.paused).length < MAX_PLAYING)) {
        playing.add(v)
        void v.play().catch(() => playing.delete(v))
      } else {
        v.pause()
        playing.delete(v)
      }
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !v.getAttribute("src")) v.src = `${url.split("#")[0]}#t=${start}`
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
  }, [url, file, start, end])
  return (
    <div ref={box} className={cn("relative overflow-hidden", className)}>
      {file && (
        <>
          <video ref={video} muted loop={false} playsInline preload="none" aria-hidden tabIndex={-1} className="pointer-events-none absolute inset-0 size-full object-cover" />
          <div aria-hidden className={cn("pointer-events-none absolute inset-0", scrim)} />
        </>
      )}
      {children && <div className="relative">{children}</div>}
    </div>
  )
}
