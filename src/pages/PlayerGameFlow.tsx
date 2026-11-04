import { Activity } from "lucide-react"
import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { leagueFlow, playerFlow } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// One player's game flow beside the league's, as a collapsed section. With about 30 shots a player, most of it says
// "too early to tell".
export function PlayerGameFlow({ state, pid }: { state: PooleanState; pid: string }) {
  const flow = useMemo(() => playerFlow(state, pid), [state, pid])
  const league = useMemo(() => leagueFlow(state), [state])
  if (flow.shots === 0) return null
  return (
    <Section id="player-flow" title="Game flow" icon={Activity} teaser={`Does this player start slow or fade? ${flow.shots} shots with video times.`}>
      <FlowView flow={flow} league={league} />
    </Section>
  )
}
