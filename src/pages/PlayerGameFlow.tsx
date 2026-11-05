import { Activity } from "lucide-react"
import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { TAB_LIST, TAB_TRIGGER } from "@/components/PanelGroup"
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
      <Tabs defaultValue="flow" className="gap-4">
        <TabsList {...TAB_LIST}>
          <TabsTrigger value="flow" {...TAB_TRIGGER}>Tire or lock in</TabsTrigger>
          <TabsTrigger value="score" {...TAB_TRIGGER}>By score</TabsTrigger>
        </TabsList>
        <TabsContent value="flow"><FlowView flow={flow} league={league} /></TabsContent>
        <TabsContent value="score"><ScoreStateBody state={state} pid={pid} /></TabsContent>
      </Tabs>
    </Section>
  )
}
