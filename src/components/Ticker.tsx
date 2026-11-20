import { Pause, Play } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { ClipBackdrop, clipSpan } from "@/components/ClipBackdrop"
import { ClipButton } from "@/components/ClipTile"
import { clipKey, type Clip } from "@/lib/clips"
import { playerName } from "@/lib/players"
import { useDesktop } from "@/lib/useDesktop"
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
  const desktop = useDesktop()
  const [onAir, setOnAir] = useState<Clip | null>(null) // the last clip shown; held, dimmed, while a headline has none, so the window does not jump
  const at = n ? i % n : 0

  useEffect(() => {
    if (!n || paused) return
    const over = still ? 0 : Math.max(0, (line.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0))
    const travel = (over / SPEED) * 1000
    setShift(0)
    const start = setTimeout(() => setShift(over), HOLD)
    // A headline stays up at least as long as its clip, so the clip is never cut off by the next headline.
    const clip = desktop ? items[at]?.clip : undefined
    const clipMs = clip ? (clipSpan(clip) + 1) * 1000 : 0
    const next = setTimeout(() => setI((x) => x + 1), Math.max(HOLD + travel + HOLD + (still ? 3000 : 0), clipMs))
    return () => {
      clearTimeout(start)
      clearTimeout(next)
    }
  }, [at, n, paused, still, desktop, items])

  useEffect(() => {
    const c = items[at]?.clip
    if (c) setOnAir(c)
  }, [items, at])

  if (!n) return null
  const item = items[at]
  const live = !!item.clip
  return (
    <div className="flex flex-col gap-2">
    {desktop && onAir && (
      <div className="relative h-80 w-full overflow-hidden rounded-xl border bg-black" aria-label="Clip from the headlines">
        <ClipBackdrop key={clipKey(onAir)} state={state} clip={onAir} still={!live} contain scrim="bg-transparent" className={`absolute inset-0 transition-opacity ${live ? "" : "opacity-50"}`} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs text-white">
          <span className="font-semibold">{onAir.label}</span>, {playerName(state, onAir.playerId)}
        </div>
      </div>
    )}
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
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground max-sm:hidden" aria-hidden>
        {at + 1}/{n}
      </span>
      {item.clip && <ClipButton state={state} clip={item.clip} label="Watch the play of the night" />}
      <button type="button" className="grid size-9 shrink-0 place-items-center text-muted-foreground" aria-label={paused ? "Play headlines" : "Pause headlines"} onClick={() => setPaused(!paused)}>
        {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
      </button>
    </div>
    </div>
  )
}
