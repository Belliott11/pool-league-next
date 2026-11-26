import { cn } from "@/lib/utils"
import type { SeasonTeam } from "@/lib/types"

// A season team's color dot and name (src/lib/seasonTeams.ts).
export function TeamChip({ team, className }: { team: SeasonTeam; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: team.color }} />
      <span className="font-semibold">{team.name}</span>
    </span>
  )
}
