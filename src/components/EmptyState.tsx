import type { ReactNode } from "react"
import { ClipBackdrop } from "@/components/ClipBackdrop"
import { artFor } from "@/lib/emptyArt"
import { cn } from "@/lib/utils"

// One look for every "nothing here yet" box: say what is missing, then what to do about it. A still from a good play sits faintly behind it.
export function EmptyState({ title, hint, action, className }: { title: string; hint?: string; action?: ReactNode; className?: string }) {
  const art = artFor(title)
  return (
    <div className={cn("relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-center", className)}>
      {art && <ClipBackdrop state={art.state} clip={art.clip} still scrim="bg-background/85" className="absolute inset-0" />}
      <span aria-hidden className="anim-ball relative mb-1 size-4 rounded-full bg-accent" />
      <p className="relative text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="relative max-w-prose text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="relative mt-2">{action}</div>}
    </div>
  )
}
