import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

// Digits drawn as a flip-dot display: a grid of round discs that show bright on one side and dark on the other.
// When a number changes, only the discs that change state flip over.
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
}

export interface Cell {
  x: number
  y: number
  on: boolean
}

// Every disc of a piece of text, in grid units: 7 rows tall, one empty column between characters.
export function glyphCells(text: string): { cells: Cell[]; width: number } {
  const cells: Cell[] = []
  let x = 0
  for (const ch of text.replace(/[−—–]/g, "-")) {
    const g = GLYPHS[ch]
    if (!g) continue
    for (let r = 0; r < 7; r++) for (let c = 0; c < g[r].length; c++) cells.push({ x: x + c, y: r, on: g[r][c] === "1" })
    x += g[0].length + 1
  }
  return { cells, width: Math.max(1, x - 1) }
}

export function FlipDigits({ value, className }: { value: string | number; className?: string }) {
  const text = String(value)
  const { cells, width } = glyphCells(text)
  // The first paint is plain; discs flip only when the number changes after that.
  const settled = useRef(false)
  useEffect(() => {
    settled.current = true
  }, [])
  return (
    <svg viewBox={`0 0 ${width} 7`} role="img" aria-label={text} className={cn("inline-block h-[0.8em] w-auto align-baseline", className)} fill="currentColor">
      {cells.map((c) => (
        <circle
          key={`${c.x}-${c.y}-${c.on ? 1 : 0}`}
          cx={c.x + 0.5}
          cy={c.y + 0.5}
          r={0.42}
          opacity={c.on ? 1 : 0.13}
          className={settled.current ? "flip-dot" : undefined}
          style={{ ["--c" as string]: c.x }}
        />
      ))}
    </svg>
  )
}
