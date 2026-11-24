import { History, Shuffle } from "lucide-react"
import { useMemo, useState } from "react"
import { ClipTile } from "@/components/ClipTile"
import { Button } from "@/components/ui/button"
import shares from "@/data/clip-shares.json"
import { clipIdOf } from "@/lib/clipShare"
import { gameClips, type Clip } from "@/lib/clips"
import type { PooleanState } from "@/lib/types"

const SHARED = shares as Record<string, unknown>

// Days since 1970 on this phone's own calendar, so the play changes at local midnight.
const today = () => {
  const d = new Date()
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000)
}

// One play from last summer each day between seasons, the same for everyone on a given day. Only clips cleared for sharing
// (clip-shares.json: never one that goes badly for someone). "Another" steps to the next one, for this visit only.
export function Throwback({ state }: { state: PooleanState }) {
  const plays = useMemo(() => {
    const out: { id: string; clip: Clip }[] = []
    for (const g of state.games)
      for (const c of gameClips(state, g)) {
        const id = clipIdOf(state, c)
        if (id && SHARED[id] && !out.some((x) => x.id === id)) out.push({ id, clip: c })
      }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }, [state])
  const [step, setStep] = useState(0)
  if (plays.length === 0) return null
  // A stride that shares no factor with the count visits every play before repeating, and neighbouring days are not neighbours.
  const stride = [7, 11, 13, 17, 19, 23].find((s) => plays.length % s !== 0) ?? 1
  const pick = plays[(((today() + step) * stride) % plays.length + plays.length) % plays.length]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History aria-hidden className="size-4 text-accent" /> Throwback of the day
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setStep((s) => s + 1)}>
          <Shuffle aria-hidden /> Another
        </Button>
      </div>
      <ClipTile key={pick.id} state={state} clip={pick.clip} />
    </div>
  )
}
