import type { Toggles } from "@/lib/legacy"
import type { PooleanState } from "@/lib/types"
import { SeasonRates } from "./leaderboard/SeasonRates"

export function LeaderboardPage({
  state,
  toggles,
  setToggles,
  onOpenPlayer,
}: {
  state: PooleanState
  toggles: Toggles
  setToggles: (t: Toggles) => void
  onOpenPlayer: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
    </div>
  )
}
