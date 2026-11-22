import { ArrowLeft } from "lucide-react"
import { useMemo } from "react"
import { ClipTile } from "@/components/ClipTile"
import { Button } from "@/components/ui/button"
import { clipById } from "@/lib/clipShare"
import type { PooleanState } from "@/lib/types"

// One play, opened from a shared link (src/lib/clipShare.ts).
export function ClipPage({ state, id, onBack, onOpenGame }: { state: PooleanState; id: string; onBack: () => void; onOpenGame: (gameId: string) => void }) {
  const clip = useMemo(() => clipById(state, id), [state, id])
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={onBack}>
        <ArrowLeft aria-hidden /> Back to games
      </Button>
      {clip ? (
        <>
          <ClipTile state={state} clip={clip} />
          <Button variant="outline" className="self-start" onClick={() => onOpenGame(clip.gameId)}>
            See the whole game
          </Button>
        </>
      ) : (
        <p className="text-muted-foreground">That play is not here anymore. It may have been trimmed differently or removed since the link was made.</p>
      )}
    </div>
  )
}
