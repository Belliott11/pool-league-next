import { useMemo } from "react"
import { ClipBackdrop } from "@/components/ClipBackdrop"
import { bestClips, type Clip } from "@/lib/clips"
import type { PooleanState } from "@/lib/types"

// A still of this player's best moment (a dunk, a shot on someone, or a marked highlight first) filling the box it sits in. Put it first in
// a `relative overflow-hidden` container and give the content `relative`. Nothing at all for a player with no recorded play.
export function PlayerShot({ state, pid, scrim = "bg-card/80" }: { state: PooleanState; pid: string; scrim?: string }) {
  const clip = useMemo(() => {
    const pick = (kinds?: Clip["kind"][]) => bestClips(state, { pid, limit: 1, kinds })[0]
    return pick(["marked", "dunk", "block", "beat"]) ?? pick()
  }, [state, pid])
  if (!clip) return null
  return <ClipBackdrop state={state} clip={clip} still scrim={scrim} className="absolute inset-0" />
}
