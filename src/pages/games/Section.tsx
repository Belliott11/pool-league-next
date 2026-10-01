import type { ReactNode } from "react"

// Collapsible group with a one-line teaser, same idea as the classic site's .player-section.
export function Section({ id, title, teaser, children }: { id: string; title: string; teaser: string; children: ReactNode }) {
  return (
    <details id={id} className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground transition-transform group-open:rotate-90">&#9656;</span>
        <h3 className="font-display text-lg font-bold">{title}</h3>
        <span className="text-sm text-muted-foreground">{teaser}</span>
      </summary>
      <div className="flex flex-col gap-4 p-4 pt-0">{children}</div>
    </details>
  )
}
