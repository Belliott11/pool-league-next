import { Activity } from "lucide-react"
import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { ViewTabs } from "@/components/PanelGroup"
import { ScoreStateBody } from "@/pages/PlayerTempo"
import { leagueFlow, playerFlow } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// One player's game flow beside the league's, as a collapsed section. With about 30 shots a player, most of it says
// "too early to tell".
export function PlayerGameFlow({ state, pid }: { state: PooleanState; pid: string }) {
  const flow = useMemo(() => playerFlow(state, pid), [state, pid])
  const league = useMemo(() => leagueFlow(state), [state])
  if (flow.shots === 0) return null
  return (
    <Section id="player-flow" title="Game flow" icon={Activity} teaser={`Slow starts, fading, and shooting behind or ahead. ${flow.shots} shots with video times.`}>
      <ViewTabs
        tabs={[
          { value: "flow", label: "Tire or lock in", node: <FlowView flow={flow} league={league} /> },
          { value: "score", label: "By score", node: <ScoreStateBody state={state} pid={pid} /> },
        ]}
      />
    </Section>
  )
}
