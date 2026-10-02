import { useEffect, useRef, useState } from "react"

// The drawable width of a chart frame (its padding taken off), kept up to date as it resizes.
// Charts draw their SVG at this width so text stays at its real size on a phone instead of being
// shrunk along with a wider drawing. Falls back to `fallback` until the first measurement.
export function useWidth<T extends HTMLElement = HTMLDivElement>(pad = 16, fallback = 560) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const next = Math.floor(el.clientWidth - pad)
      if (next > 0) setW(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pad])
  return [ref, Math.max(240, w)] as const
}
