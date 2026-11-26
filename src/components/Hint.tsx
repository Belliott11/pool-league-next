import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

// A panel's explanation. A long one shows its first three lines with "More" (the older panels' notes run to a paragraph or two), so the
// panel's chart or table is not pushed down the screen.
const LONG = 220

export function Hint({ text, className }: { text: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const long = typeof text === "string" && text.length > LONG
  return (
    <div className={cn("text-sm text-muted-foreground", className)}>
      <p className={cn(long && !open && "line-clamp-3")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-0.5 text-xs font-medium text-foreground underline underline-offset-2">
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  )
}
