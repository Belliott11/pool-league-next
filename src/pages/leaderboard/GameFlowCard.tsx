import { Activity } from "lucide-react"
import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { leagueFlow } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// When in a game and a night the league scores and shoots: do people tire out or lock in? A collapsed section like the
// others on this tab; its contents are only built once it is opened.
export function GameFlowCard({ state }: { state: PooleanState }) {
  const flow = useMemo(() => leagueFlow(state), [state])
  const teaser = flow.games === 0 ? "Needs games logged shot by shot with video times." : `Do people tire out or lock in? ${flow.shots} shots from ${flow.games} games.`
  return (
    <Section id="lb-flow" title="Game flow" icon={Activity} teaser={teaser}>
      {flow.games === 0 ? <p className="text-sm text-muted-foreground">Games show up here once they are logged shot by shot, with video times and 12 or more shots.</p> : <FlowView flow={flow} />}
    </Section>
  )
}
