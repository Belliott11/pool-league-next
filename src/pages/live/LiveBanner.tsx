import { FlipDigits } from "@/components/FlipDigits"
import { findLiveGame, liveTotals } from "@/lib/live"
import type { PooleanState } from "@/lib/types"
import { LiveOddsMini } from "./LiveOdds"

// A prominent card on the Games tab while a game is being scored, so a visitor sees it straight away.
export function LiveBanner({ state, onOpen }: { state: PooleanState; onOpen: () => void }) {
  const g = findLiveGame(state)
  if (!g) return null
  const [a, b] = liveTotals(g)
  return (
    <button type="button" onClick={onOpen} className="flex flex-col gap-2 rounded-xl border-2 border-primary bg-card p-4 text-left">
      <span className="flex items-center gap-2 text-sm font-semibold text-primary">
        <span aria-hidden className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span className="relative size-2.5 rounded-full bg-primary" />
        </span>
        Live now
      </span>
      <span className="flex items-center gap-2 self-start text-3xl">
        <FlipDigits value={a} /> <span className="text-muted-foreground"><FlipDigits value="-" /></span> <FlipDigits value={b} />
      </span>
      <LiveOddsMini game={g} />
      <span className="text-sm text-muted-foreground">Tap to watch. It updates by itself.</span>
    </button>
  )
}
