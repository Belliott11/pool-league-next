import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { leagueFlow, playerFlow } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// One player's game flow beside the league's. With about 30 shots a player, most of it says "too early to tell".
export function PlayerGameFlow({ state, pid }: { state: PooleanState; pid: string }) {
  const flow = useMemo(() => playerFlow(state, pid), [state, pid])
  const league = useMemo(() => leagueFlow(state), [state])
  if (flow.shots === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Game flow</CardTitle>
      </CardHeader>
      <CardContent>
        <FlowView flow={flow} league={league} />
      </CardContent>
    </Card>
  )
}
