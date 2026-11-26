import { createPortal } from "react-dom"
import { ShotLoader } from "@/components/ShotLoader"

// Shown while a tab's code loads: the shot loader in the middle of the screen.
export function PageSkeleton({ label }: { label: string }) {
  // In a portal so a tab's animated wrapper cannot become the box that "fixed" is measured against. On top of everything (the header,
  // bottom bar and dialogs are z-30 to z-50); it takes no taps, so nothing under it is blocked.
  return createPortal(
    <div role="status" aria-label={label} className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
      <ShotLoader />
      <span className="sr-only">{label}</span>
    </div>,
    document.body,
  )
}
