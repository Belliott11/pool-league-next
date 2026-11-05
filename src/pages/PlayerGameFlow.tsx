import { Activity } from "lucide-react"
import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
      <Tabs defaultValue="flow">
        <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="flow" className="h-auto flex-none px-3 py-1.5">Tire or lock in</TabsTrigger>
          <TabsTrigger value="score" className="h-auto flex-none px-3 py-1.5">By score</TabsTrigger>
        </TabsList>
        <TabsContent value="flow"><FlowView flow={flow} league={league} /></TabsContent>
        <TabsContent value="score"><ScoreStateBody state={state} pid={pid} /></TabsContent>
      </Tabs>
    </Section>
  )
}
