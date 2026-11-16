import { Pause, Play } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { tickerItems } from "@/lib/ticker"
import type { PooleanState } from "@/lib/types"

const SPEED = 55 // pixels a second while a long headline scrolls past
const HOLD = 2200 // how long a headline rests before and after it scrolls

// The broadcast bar: one headline at a time under its tag. A headline that does not fit scrolls sideways to its end, rests,
// and the next one flips in. Tapping the bar pauses it. With reduced motion it wraps and changes without sliding.
export function Ticker({ state }: { state: PooleanState }) {
  const items = useMemo(() => tickerItems(state), [state])
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [shift, setShift] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const line = useRef<HTMLSpanElement>(null)
  const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  const n = items.length
  const at = n ? i % n : 0

  useEffect(() => {
    if (!n || paused) return
    const over = still ? 0 : Math.max(0, (line.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0))
    const travel = (over / SPEED) * 1000
    setShift(0)
    const start = setTimeout(() => setShift(over), HOLD)
    const next = setTimeout(() => setI((x) => x + 1), HOLD + travel + HOLD + (still ? 3000 : 0))
    return () => {
      clearTimeout(start)
      clearTimeout(next)
    }
  }, [at, n, paused, still])

  if (!n) return null
  const item = items[at]
  return (
    <div className="ticker" role="group" aria-label="League headlines">
      <span key={item.tag} className="ticker-tag">
        {item.tag}
      </span>
      <div ref={box} className={`min-w-0 flex-1 overflow-hidden ${still ? "" : "whitespace-nowrap"}`}>
        <span
          key={at}
          ref={line}
          className="ticker-line inline-block"
          style={{ transform: `translateX(-${shift}px)`, transition: shift ? `transform ${shift / SPEED}s linear` : "none" }}
        >
          {item.text}
        </span>
      </div>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-hidden>
        {at + 1}/{n}
      </span>
      <button type="button" className="grid size-9 shrink-0 place-items-center text-muted-foreground" aria-label={paused ? "Play headlines" : "Pause headlines"} onClick={() => setPaused(!paused)}>
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>
    </div>
  )
}
