import { useState } from "react"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { BalanceTeams } from "./BalanceTeams"
import { MatchupPredictor } from "./MatchupPredictor"
import { PartyPlanner } from "./PartyPlanner"

// Attendee picks aren't saved (a throwaway decision each session, same as the classic site).
// Balance Teams and the Party Night Planner each keep their own list, with a button to copy one
// over to the other.
export function BalanceAndPredict({
  state,
  update,
  onCreated,
}: {
  state: PooleanState
  update: Update
  onCreated: (g: Game) => void
}) {
  const [balanceIds, setBalanceIds] = useState<string[]>([])
  const [plannerIds, setPlannerIds] = useState<string[]>([])
  return (
    <div className="flex flex-col gap-4">
      <BalanceTeams state={state} update={update} attendees={balanceIds} setAttendees={setBalanceIds} onCreated={onCreated} />
      <MatchupPredictor state={state} />
      <PartyPlanner state={state} attendees={plannerIds} setAttendees={setPlannerIds} balanceAttendees={balanceIds} />
    </div>
  )
}
