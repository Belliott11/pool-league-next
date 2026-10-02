import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// One look for every "nothing here yet" box: say what is missing, then what to do about it.
export function EmptyState({ title, hint, action, className }: { title: string; hint?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-xl border border-dashed bg-muted/30 px-4 py-5 text-center", className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-prose text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
