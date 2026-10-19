import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

// A 3x3 of tiles that slide around each other, after the "Banter" loader on Uiverse.io (MIT, by Nawsome), redrawn in the
// logo's colours. Each tile starts on its own square and visits the others in 11 steps, in tile widths.
const START: [number, number][] = [[1, 0], [1, 0], [2, 2], [1, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]]
const PATH: [number, number][][] = [
  [[-1, 0], [0, 0], [0, 0], [1, 0], [1, 1], [1, 1], [1, 1], [1, 0], [0, 0], [-1, 0], [0, 0]],
  [[0, 0], [1, 0], [0, 0], [1, 0], [1, 1], [1, 1], [1, 1], [1, 1], [0, 1], [0, 1], [0, 0]],
  [[-1, 0], [-1, 0], [0, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, 0], [-1, -1], [0, -1], [0, 0]],
  [[-1, 0], [-1, 0], [-1, -1], [0, -1], [0, 0], [0, -1], [0, -1], [0, -1], [-1, -1], [-1, 0], [0, 0]],
  [[0, 0], [0, 0], [0, 0], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0], [1, -1], [0, -1], [0, 0]],
  [[0, 0], [-1, 0], [-1, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 1], [-1, 1], [-1, 0], [0, 0]],
  [[1, 0], [1, 0], [1, 0], [0, 0], [0, -1], [1, -1], [0, -1], [0, -1], [0, 0], [1, 0], [0, 0]],
  [[0, 0], [-1, 0], [-1, -1], [0, -1], [0, -1], [0, -1], [0, -1], [0, -1], [1, -1], [1, 0], [0, 0]],
  [[-1, 0], [-1, 0], [0, 0], [-1, 0], [0, 0], [0, 0], [-1, 0], [-1, 0], [-2, 0], [-1, 0], [0, 0]],
]
// Red, white and blue, the same as the logo ball. The white tile gets a thin edge so it shows on a light page.
const COLORS = ["bg-[#1d4fd8]", "bg-[#f4f6f7] ring-1 ring-foreground/20", "bg-[#e3262e]"]
const PITCH = 1.625 // rem between tile origins (tile 1.25rem + 0.375rem gap)

export function TileShuffle({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const anims = [...(ref.current?.children ?? [])].map((el, i) =>
      el.animate([{ transform: "translate(0,0)" }, ...PATH[i].map(([x, y]) => ({ transform: `translate(${x * PITCH}rem, ${y * PITCH}rem)` }))], { duration: 4000, iterations: Infinity }),
    )
    return () => anims.forEach((a) => a.cancel())
  }, [])
  return (
    <div ref={ref} aria-hidden className={cn("relative size-[4.5rem]", className)}>
      {START.map(([x, y], i) => (
        <span key={i} className={cn("absolute size-5 rounded-[3px]", COLORS[i % 3])} style={{ left: `${x * PITCH}rem`, top: `${y * PITCH}rem` }} />
      ))}
    </div>
  )
}
