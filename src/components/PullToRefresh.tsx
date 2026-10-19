import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { TileShuffle } from "@/components/TileShuffle"

const TRIGGER = 64
const MAX = 96

// Pull down from the top of the page on a phone to fetch the latest data. The tile shuffle plays while it loads.
// It stays out of live scoring, form fields and dialogs, and only counts mostly-vertical drags.
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> }) {
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const pullRef = useRef(0)
  const busyRef = useRef(false)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const set = (v: number) => {
      pullRef.current = v
      setPull(v)
    }
    const down = (e: TouchEvent) => {
      const t = e.target as Element | null
      if (busyRef.current || window.scrollY > 0 || e.touches.length !== 1 || t?.closest("[data-no-swipe], input, textarea, select, [role=dialog]")) return
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
    const move = (e: TouchEvent) => {
      const s = start.current
      if (!s) return
      const dx = e.touches[0].clientX - s.x
      const dy = e.touches[0].clientY - s.y
      if (dy <= 0 || dy < Math.abs(dx) * 1.5 || window.scrollY > 0) return set(0)
      set(Math.min(MAX, dy * 0.5))
    }
    const up = async () => {
      const go = pullRef.current >= TRIGGER
      start.current = null
      if (!go) return set(0)
      busyRef.current = true
      setBusy(true)
      set(TRIGGER)
      await Promise.all([refreshRef.current().catch(() => {}), new Promise((r) => setTimeout(r, 700))])
      busyRef.current = false
      setBusy(false)
      set(0)
    }
    window.addEventListener("touchstart", down, { passive: true })
    window.addEventListener("touchmove", move, { passive: true })
    window.addEventListener("touchend", up)
    window.addEventListener("touchcancel", up)
    return () => {
      window.removeEventListener("touchstart", down)
      window.removeEventListener("touchmove", move)
      window.removeEventListener("touchend", up)
      window.removeEventListener("touchcancel", up)
    }
  }, [])

  if (pull === 0 && !busy) return null
  return createPortal(
    <div
      role="status"
      aria-label={busy ? "Refreshing" : pull >= TRIGGER ? "Release to refresh" : "Pull to refresh"}
      className="pointer-events-none fixed left-0 right-0 top-0 z-20 flex justify-center"
      style={{ transform: `translateY(${pull - 56}px)`, opacity: Math.min(1, pull / 40) }}
    >
      <div className="flex size-12 items-center justify-center rounded-full border bg-card shadow-md">
        <div className="size-[4.5rem] scale-[0.4] shrink-0">
          <TileShuffle />
        </div>
      </div>
    </div>,
    document.body,
  )
}
