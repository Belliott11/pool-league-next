import { glyphCells } from "@/components/FlipDigits"
import { cn } from "@/lib/utils"

// A tank-top jersey with a stat printed on the front in flip-dot digits, the way a number would be.
export function JerseyStat({ value, label, className }: { value: string; label: string; className?: string }) {
  const { cells, width } = glyphCells(value)
  const scale = Math.min(5.2, 38 / width)
  return (
    <svg viewBox="0 0 64 72" role="img" aria-label={`${label} ${value}`} className={cn("h-28 w-auto shrink-0", className)}>
      <path d="M16 3H26C26 13 38 13 38 3H48C48 15 52 21 55 27V70H9V27C12 21 16 15 16 3Z" fill="var(--primary)" stroke="var(--card)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 66H52" stroke="var(--primary-foreground)" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
      <g transform={`translate(${32 - (width * scale) / 2} ${44 - (7 * scale) / 2}) scale(${scale})`} fill="var(--primary-foreground)">
        {cells.map((c) => (
          <circle key={`${c.x}-${c.y}`} cx={c.x + 0.5} cy={c.y + 0.5} r={0.42} opacity={c.on ? 1 : 0.18} />
        ))}
      </g>
    </svg>
  )
}
