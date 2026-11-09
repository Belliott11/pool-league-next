import { Activity } from "lucide-react"
import { useMemo, useState } from "react"
import { FlowView } from "@/components/FlowView"
import { Section } from "@/components/Section"
import { ViewTabs } from "@/components/PanelGroup"
import { PlayerPick } from "@/components/PlayerPick"
import { TempoBody } from "./TempoCard"
import { leagueFlow, playerFlow } from "@/lib/gameFlow"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

// When in a game and a night the league scores and shoots: do people tire out or lock in? A collapsed section like the
// others on this tab; its contents are only built once it is opened.
export function GameFlowBody({ state, pid }: { state: PooleanState; pid?: string }) {
  const league = useMemo(() => leagueFlow(state), [state])
  const mine = useMemo(() => (pid ? playerFlow(state, pid) : null), [state, pid])
  if (mine) return mine.shots === 0 ? <p className="text-sm text-muted-foreground">{playerName(state, pid!)} has no timed shots yet.</p> : <FlowView flow={mine} league={league} />
  return league.games === 0 ? <p className="text-sm text-muted-foreground">Games show up here once they are logged shot by shot, with video times and 12 or more shots.</p> : <FlowView flow={league} />
}

// Game flow and Pace, runs and swings are one section with a tab each: both come from the same timed games.
export function GameFlowCard({ state }: { state: PooleanState }) {
  const [pid, setPid] = useState("")
  const flow = useMemo(() => leagueFlow(state), [state])
  // Pace, runs and swings belong to a game, so for one player they come from the games they were in.
  const theirs = useMemo(() => (pid ? { ...state, games: state.games.filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid)) } : state), [state, pid])
  const teaser = flow.games === 0 ? "Needs games logged shot by shot with video times." : `Do people tire out, how fast games go and how leads swing. ${flow.games} games.`
  return (
    <Section id="lb-flow" title="Game flow" icon={Activity} teaser={teaser}>
      <PlayerPick state={state} value={pid} onChange={setPid} />
      <ViewTabs
        tabs={[
          { value: "flow", label: "Tire or lock in", node: <GameFlowBody state={state} pid={pid} /> },
          { value: "tempo", label: pid ? "Pace, runs and swings (their games)" : "Pace, runs and swings", node: <TempoBody state={theirs} /> },
        ]}
      />
    </Section>
  )
}
