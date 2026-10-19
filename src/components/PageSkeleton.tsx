import { TileShuffle } from "@/components/TileShuffle"

// Stand-in shown while a tab's code loads: the rough shape of the page instead of a line of text.
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      <div className="flex h-24 items-center justify-center rounded-xl bg-muted/60">
        <TileShuffle />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
