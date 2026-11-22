import { Info } from "lucide-react"
import { definitionOf } from "@/lib/terms"
import { cn } from "@/lib/utils"

// A small ⓘ beside a stat label that opens its plain definition (from src/lib/terms.ts). Tap again, or anywhere else, to close.
export function Explain({ term, className }: { term: string; className?: string }) {
  const def = definitionOf(term)
  if (!def) return null
  return (
    <details data-menu className={cn("relative inline-block align-middle", className)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && (e.currentTarget.open = false)}>
      <summary className="inline-grid size-6 cursor-pointer list-none place-items-center rounded-full text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden" aria-label={`What ${term} means`}>
        <Info aria-hidden className="size-3.5" />
      </summary>
      <span role="note" tabIndex={-1} className="absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border bg-popover p-2.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-popover-foreground shadow-lg">
        <span className="font-semibold">{term}: </span>
        {def}
      </span>
    </details>
  )
}
