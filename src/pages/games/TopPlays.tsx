import { Clapperboard } from "lucide-react"
import { useMemo } from "react"
import { ClipStrip } from "@/components/ClipTile"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { bestClips } from "@/lib/clips"
import { seasonState } from "@/lib/offseason"
import type { PooleanState } from "@/lib/types"

// The season's best few plays on the home page, each with its own Share button: marked and kept highlights first (see bestClips), one per
// game, never one that goes badly for anyone.
export function TopPlays({ state }: { state: PooleanState }) {
  const clips = useMemo(() => bestClips(seasonState(state), { limit: 12, perGame: 1 }).filter((c) => !c.rough?.length).slice(0, 3), [state])
  if (clips.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clapperboard aria-hidden className="size-4 text-accent" /> Top plays of the season
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ClipStrip state={state} clips={clips} />
      </CardContent>
    </Card>
  )
}
