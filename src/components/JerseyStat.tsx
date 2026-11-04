import { useMemo } from "react"
import { glyphCells } from "@/components/FlipDigits"
import { cn } from "@/lib/utils"

// A tank-top jersey made of dots, like a flip-dot sign: the body is a grid of discs in the accent color and the stat
// is picked out on the chest in brighter discs. The jersey is a polygon on a 64 by 72 sheet; every grid cell whose
// centre falls inside it becomes a disc, so the digits and the jersey share one grid.
const SHAPE: [number, number][] = [
  [16, 3], [26, 3], [26.5, 8], [29, 11], [32, 12], [35, 11], [37.5, 8], [38, 3], [48, 3],
  [48.5, 10], [50, 16], [53, 22], [55, 27], [55, 70], [9, 70], [9, 27], [11, 22], [14, 16], [15.5, 10],
]

// Ray casting: is the point inside the polygon.
function inside(x: number, y: number): boolean {
  let hit = false
  for (let i = 0, j = SHAPE.length - 1; i < SHAPE.length; j = i++) {
    const [xi, yi] = SHAPE[i]
    const [xj, yj] = SHAPE[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

export function JerseyStat({ value, label, className }: { value: string; label: string; className?: string }) {
  const dots = useMemo(() => {
    const { cells, width } = glyphCells(value)
    // Disc pitch: roomy for short numbers, tighter for long ones so the digits always fit on the chest.
    const p = Math.min(2.9, 40 / width)
    const col0 = Math.round((32 - (width * p) / 2) / p)
    const row0 = Math.round((46 - (7 * p) / 2) / p)
    const digit = new Map(cells.map((c) => [`${c.x + col0},${c.y + row0}`, c.on]))
    const out: { x: number; y: number; kind: "body" | "on" | "off" }[] = []
    for (let r = 0; r < 72 / p; r++) {
      for (let c = 0; c < 64 / p; c++) {
        const x = (c + 0.5) * p
        const y = (r + 0.5) * p
        if (!inside(x, y)) continue
        const d = digit.get(`${c},${r}`)
        out.push({ x, y, kind: d === undefined ? "body" : d ? "on" : "off" })
      }
    }
    return { out, r: p * 0.42 }
  }, [value])
  return (
    <svg viewBox="0 0 64 72" role="img" aria-label={`${label} ${value}`} className={cn("h-28 w-auto shrink-0", className)}>
      {dots.out.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={dots.r} fill={d.kind === "on" ? "#ffffff" : d.kind === "off" ? "#000000" : "var(--primary)"} opacity={d.kind === "off" ? 0.28 : 1} />
      ))}
    </svg>
  )
}
