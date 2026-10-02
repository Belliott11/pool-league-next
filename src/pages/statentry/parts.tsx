import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// Big tap target (44px) toggle chip used for every pick list in the entry form.
export function Chip({ selected, onClick, children, disabled }: { selected?: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={!!selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        selected ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// Same space the classic shot chart stores: x 0-100 across, y 0-100 distance from the baseline
// (hoop near y=7, the 3PT line at y=60). Drawn 100x200 with the hoop at the bottom, so the tap
// position is inverted back to the stored convention.
const VB_W = 100
const VB_H = 200
const vbY = (y: number) => VB_H - (y / 100) * VB_H

export function HalfCourt({ value, onChange }: { value: { x: number; y: number } | null; onChange: (v: { x: number; y: number } | null) => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Half court. Tap where the shot was taken."
        className="h-auto w-full max-w-[200px] cursor-crosshair touch-manipulation rounded-lg border bg-muted/40"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
          const yFrac = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))
          onChange({ x: Math.round(x * 10) / 10, y: Math.round((100 - yFrac) * 10) / 10 })
        }}
      >
        <line x1="0" x2={VB_W} y1={vbY(60)} y2={vbY(60)} className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="4 3" />
        <text x={VB_W - 3} y={vbY(60) - 3} textAnchor="end" className="fill-muted-foreground" fontSize="8">3PT</text>
        <circle cx={VB_W / 2} cy={vbY(7)} r="4" className="fill-none stroke-foreground" strokeWidth="1.5" />
        {value && <circle cx={value.x} cy={vbY(value.y)} r="5" className="fill-primary stroke-background" strokeWidth="1.5" />}
      </svg>
      {value ? (
        <button type="button" onClick={() => onChange(null)} className="min-h-11 text-sm text-muted-foreground underline">
          Clear location
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">Not marked. Tap the court to place the shot.</p>
      )}
    </div>
  )
}
