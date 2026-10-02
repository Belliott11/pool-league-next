import { Radio } from "lucide-react"
import { findLiveGame, liveTotals } from "@/lib/live"
import type { PooleanState } from "@/lib/types"

export { findLiveGame }

export function LiveMiniBar({ state, onOpen }: { state: PooleanState; onOpen: () => void }) {
  const g = findLiveGame(state)
  if (!g) return null
  const [a, b] = liveTotals(g)
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-center gap-2 bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
    >
      <Radio className="size-4 shrink-0" aria-hidden />
      <span className="truncate">
        Live now: A {a} - {b} B, tap to return
      </span>
    </button>
  )
}
