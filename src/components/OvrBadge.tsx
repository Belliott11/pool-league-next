import { ArrowDown, ArrowUp } from "lucide-react"
import { FlipDigits } from "@/components/FlipDigits"
import { cn } from "@/lib/utils"

// The overall rating as a scoreboard number, with how far it moved since the latest night.
export function OvrBadge({ ovr, change, className }: { ovr: number; change?: number | null; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)} role="group" aria-label={`Overall rating ${ovr}${change ? `, ${change > 0 ? "up" : "down"} ${Math.abs(change)}` : ""}`}>
      <div className="flex flex-col items-center rounded-lg bg-primary px-2 py-1 text-primary-foreground">
        <span className="text-3xl leading-none">
          <FlipDigits value={ovr} />
        </span>
        <span className="text-[10px] font-bold tracking-widest">OVR</span>
      </div>
      {!!change && (
        <span className={cn("flex items-center text-sm font-semibold tabular-nums", change > 0 ? "text-pos" : "text-neg")} aria-hidden>
          {change > 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          {Math.abs(change)}
        </span>
      )}
    </div>
  )
}

// One attribute as a label, a bar from 40 to 99, and the number.
export function AttrBar({ label, value }: { label: string; value: number | null }) {
  const pct = value === null ? 0 : ((value - 40) / 59) * 100
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className={cn("anim-bar block h-full rounded-full", value !== null && value >= 85 ? "bg-gold" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right font-semibold tabular-nums">{value ?? "-"}</span>
    </div>
  )
}
