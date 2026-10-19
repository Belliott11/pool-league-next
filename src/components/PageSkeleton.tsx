import { createPortal } from "react-dom"
import { TileShuffle } from "@/components/TileShuffle"

// Shown while a tab's code loads: the tile shuffle in the middle of the screen.
export function PageSkeleton({ label }: { label: string }) {
  // In a portal so a tab's animated wrapper cannot become the box that "fixed" is measured against.
  return createPortal(
    <div role="status" aria-label={label} className="pointer-events-none fixed inset-0 z-10 flex items-center justify-center">
      <TileShuffle />
      <span className="sr-only">{label}</span>
    </div>,
    document.body,
  )
}
