import { useEffect, useRef, useState } from "react"
import { haptic } from "./haptics"

// Swipe right on an element: the farther the drag, the higher the step (1, 2, 3, ...). Each new step
// ticks, and letting go commits the step reached. Vertical drags are left to the page so scrolling
// still works; the element should have `touch-action: pan-y`.
export function useSwipeSteps(onCommit: (step: number) => void, thresholds: number[] = [56, 116, 176], max = 200) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)
  const last = useRef(0)
  const commit = useRef(onCommit)
  commit.current = onCommit
  const [dx, setDx] = useState(0)
  const [step, setStep] = useState(0)

  const reset = () => {
    start.current = null
    dragging.current = false
    last.current = 0
    setDx(0)
    setStep(0)
  }

  const bind = {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      start.current = { x: e.clientX, y: e.clientY }
      dragging.current = false
      last.current = 0
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = start.current
      if (!s) return
      const mx = e.clientX - s.x
      const my = e.clientY - s.y
      if (!dragging.current) {
        if (Math.abs(my) > 12 && Math.abs(my) > Math.abs(mx)) {
          start.current = null
          return
        }
        if (mx > 12 && mx > Math.abs(my) * 1.5) {
          dragging.current = true
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* a pointer that is already gone: the drag still works without capture */
          }
        } else return
      }
      const d = Math.max(0, Math.min(max, mx))
      setDx(d)
      const reached = thresholds.filter((t) => d >= t).length
      if (reached !== last.current) {
        if (reached > last.current) haptic(reached >= thresholds.length ? "medium" : "tick")
        last.current = reached
        setStep(reached)
      }
    },
    onPointerUp: () => {
      if (dragging.current && last.current > 0) {
        haptic("light")
        commit.current(last.current)
      }
      reset()
    },
    onPointerCancel: reset,
  }
  return { bind, dx, step }
}

// Swipe left or right anywhere on the page (touch screens only) to move to the next or previous tab.
// A swipe that starts on something that scrolls sideways, a form control, a video, or anything marked
// data-no-swipe is left alone, so tables, charts, inputs and the live scoreboard keep their own gestures.
const BLOCK = "input, textarea, select, video, [role=slider], [data-no-swipe]"

function blocked(el: HTMLElement | null) {
  if (!el) return true
  if (el.closest(BLOCK)) return true
  for (let p: HTMLElement | null = el; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowX
    if ((o === "auto" || o === "scroll") && p.scrollWidth > p.clientWidth + 1) return true
  }
  return false
}

export function useTabSwipe(tab: string, order: string[], setTab: (t: string) => void) {
  const latest = useRef({ tab, order, setTab })
  latest.current = { tab, order, setTab }
  useEffect(() => {
    if (typeof matchMedia === "undefined" || !matchMedia("(pointer: coarse)").matches) return
    let x = 0
    let y = 0
    let t = 0
    let ok = false
    const onStart = (e: TouchEvent) => {
      ok = e.touches.length === 1 && !blocked(e.target as HTMLElement)
      x = e.touches[0].clientX
      y = e.touches[0].clientY
      t = Date.now()
    }
    const onEnd = (e: TouchEvent) => {
      if (!ok) return
      ok = false
      const c = e.changedTouches[0]
      const dx = c.clientX - x
      const dy = c.clientY - y
      if (Math.abs(dx) < 80 || Math.abs(dx) < 2 * Math.abs(dy) || Date.now() - t > 700) return
      const { tab: cur, order: o, setTab: set } = latest.current
      const next = o[o.indexOf(cur) + (dx < 0 ? 1 : -1)]
      if (next) {
        haptic("light")
        set(next)
      }
    }
    document.addEventListener("touchstart", onStart, { passive: true })
    document.addEventListener("touchend", onEnd, { passive: true })
    return () => {
      document.removeEventListener("touchstart", onStart)
      document.removeEventListener("touchend", onEnd)
    }
  }, [])
}
