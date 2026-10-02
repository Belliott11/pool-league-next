import type { LucideIcon } from "lucide-react"

// The small tinted square that leads every group and panel title, so headers read as one family.
export function IconChip({ icon: Icon, className = "" }: { icon: LucideIcon; className?: string }) {
  return (
    <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ${className}`}>
      <Icon className="size-4" strokeWidth={2} />
    </span>
  )
}
