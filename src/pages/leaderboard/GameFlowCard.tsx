import { useMemo } from "react"
import { FlowView } from "@/components/FlowView"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { leagueFlow } from "@/lib/gameFlow"
import type { PooleanState } from "@/lib/types"

// When in a game and a night the league scores and shoots: do people tire out or lock in?
export function GameFlowCard({ state }: { state: PooleanState }) {
  const flow = useMemo(() => leagueFlow(state), [state])
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Game flow</CardTitle>
      </CardHeader>
      <CardContent>
        {flow.games === 0 ? (
          <p className="text-sm text-muted-foreground">Needs games logged shot by shot with video times (12 or more shots a game). They show up here once there are some.</p>
        ) : (
          <FlowView flow={flow} />
        )}
      </CardContent>
    </Card>
  )
}
