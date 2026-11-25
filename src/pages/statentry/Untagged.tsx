import { useState } from "react"
import { Button } from "@/components/ui/button"
import { playerName } from "@/lib/players"
import { formatVideoTime } from "@/lib/stats"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"
import type { Edit } from "./EventForm"

// Shots still missing what the defense stats need: a defender (or "No defender") and a contest level. A shot with no defender and no
// contest logged is charged to nobody, so Who stops whom, the Matchup Record and Points added all skip it.
export function needsTag(e: ScoringEvent): "defender" | "contest" | null {
  if (e.points !== 2 && e.points !== 3) return null
  const tagged = (e.defenderIds ?? []).length > 0
  if (!tagged && !e.contestLevel) return "defender"
  if (tagged && !e.contestLevel) return "contest"
  return null
}

export function Untagged({ state, game, onEdit }: { state: PooleanState; game: Game; onEdit: (e: Edit) => void }) {
  const [open, setOpen] = useState(false)
  const shots = game.scoringEvents.filter((e) => needsTag(e) !== null)
  if (!game.scoringEvents.length) return null
  if (!shots.length)
    return <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">Every shot has its defender and contest tagged.</p>
  const noDef = shots.filter((e) => needsTag(e) === "defender").length
  return (
    <div className="rounded-lg border border-gold px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {shots.length} {shots.length === 1 ? "shot needs" : "shots need"} a tag
        </span>
        <span className="text-muted-foreground">
          ({noDef} with no defender or contest, {shots.length - noDef} with a defender but no contest level). Untagged shots count against nobody in the defense stats.
        </span>
        <Button size="sm" variant="outline" className="ml-auto" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show them"}
        </Button>
      </div>
      {open && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {shots.map((e) => (
            <li key={e.id}>
              <Button size="sm" variant="outline" onClick={() => onEdit({ kind: "shot", ev: e })}>
                {typeof e.videoTime === "number" ? `${formatVideoTime(e.videoTime)} ` : ""}
                {playerName(state, e.scorerId)} {e.points}
                {e.made !== false ? " made" : " miss"}
                <span className="text-muted-foreground">{needsTag(e) === "defender" ? ", defender?" : ", contest?"}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
