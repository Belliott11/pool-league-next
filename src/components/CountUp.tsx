import { useEffect, useState } from "react"

// A number that counts up to its value when it appears. With reduced motion, or for a value that is not a plain
// whole number, it just shows the value. It counts on animation frames, with a timer as a backstop so a page in a background
// tab still ends on the right number.
export function CountUp({ value, ms = 600 }: { value: number; ms?: number }) {
  const still = typeof window === "undefined" || !Number.isInteger(value) || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const [shown, setShown] = useState(still ? value : 0)
  useEffect(() => {
    if (still) {
      setShown(value)
      return
    }
    // Animation frames for a smooth count; the timeout makes sure it ends on the value even where frames stop (a background tab).
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      setShown(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const done = setTimeout(() => setShown(value), ms + 60)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(done)
    }
  }, [value, ms, still])
  return <>{shown}</>
}
