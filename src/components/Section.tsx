import { ChevronRight, type LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { IconChip } from "@/components/IconChip"

// Collapsible group with a one-line teaser, same idea as the classic site's .player-section.
// Its panels are only built the first time it is opened, so a page with dozens of panels loads
// with just the headers and each group pays for itself when someone actually looks at it. Once
// opened, the panels stay mounted so their controls keep their state.
export function Section({ id, title, teaser, icon, children }: { id: string; title: string; teaser: string; icon?: LucideIcon; children: ReactNode }) {
  const [opened, setOpened] = useState(false)
  return (
    <details id={id} className="group scroll-mt-20 rounded-xl border bg-card" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        {icon && <IconChip icon={icon} />}
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <span className="text-sm text-muted-foreground">{teaser}</span>
      </summary>
      <div className="flex flex-col gap-4 p-4 pt-0">{opened && children}</div>
    </details>
  )
}
