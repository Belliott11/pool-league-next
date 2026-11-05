import { Activity } from "lucide-react"
import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { TAB_LIST, TAB_TRIGGER } from "@/components/PanelGroup"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TempoBody } from "./TempoCard"
import { leagueFlow } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// When in a game and a night the league scores and shoots: do people tire out or lock in? A collapsed section like the
// others on this tab; its contents are only built once it is opened.
export function GameFlowBody({ state }: { state: PooleanState }) {
  const flow = useMemo(() => leagueFlow(state), [state])
  return flow.games === 0 ? <p className="text-sm text-muted-foreground">Games show up here once they are logged shot by shot, with video times and 12 or more shots.</p> : <FlowView flow={flow} />
}

// Game flow and Pace, runs and swings are one section with a tab each: both come from the same timed games.
export function GameFlowCard({ state }: { state: PooleanState }) {
  const flow = useMemo(() => leagueFlow(state), [state])
  const teaser = flow.games === 0 ? "Needs games logged shot by shot with video times." : `Do people tire out, how fast games go and how leads swing. ${flow.games} games.`
  return (
    <Section id="lb-flow" title="Game flow" icon={Activity} teaser={teaser}>
      <Tabs defaultValue="flow" className="gap-4">
        <TabsList {...TAB_LIST}>
          <TabsTrigger value="flow" {...TAB_TRIGGER}>Tire or lock in</TabsTrigger>
          <TabsTrigger value="tempo" {...TAB_TRIGGER}>Pace, runs and swings</TabsTrigger>
        </TabsList>
        <TabsContent value="flow"><GameFlowBody state={state} /></TabsContent>
        <TabsContent value="tempo"><TempoBody state={state} /></TabsContent>
      </Tabs>
    </Section>
  )
}
