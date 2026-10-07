import { useEffect, useState } from "react"

// A number that counts up to its value when it appears. With reduced motion, or for a value that is not a plain
// whole number, it just shows the value. Driven by a timer, not animation frames, so a page in a background tab
// still ends on the right number.
export function CountUp({ value, ms = 600 }: { value: number; ms?: number }) {
  const still = typeof window === "undefined" || !Number.isInteger(value) || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const [shown, setShown] = useState(still ? value : 0)
  useEffect(() => {
    if (still) {
      setShown(value)
      return
    }
    const start = Date.now()
    const tick = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / ms)
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t >= 1) clearInterval(tick)
    }, 30)
    const done = setTimeout(() => setShown(value), ms + 60)
    return () => {
      clearInterval(tick)
      clearTimeout(done)
    }
  }, [value, ms, still])
  return <>{shown}</>
}
