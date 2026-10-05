import { PenLine, Undo2 } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { haptic } from "@/lib/haptics"
import { sendBasket, undoBasket } from "@/lib/scorekeeper"
import type { Game, PooleanState } from "@/lib/types"
import { TeamColumn, type Pop } from "./LiveGamePage"

// For anyone watching a live game who wants to help keep score: tap Keep score, then add baskets. It shows
// the scoreboard in place of the read-only view while it is on. No sign-in or code.
export function Scorekeeper({ game, state, pops, a, b, children }: { game: Game; state: PooleanState; pops: Pop[]; a: number; b: number; children: ReactNode }) {
  const [keeping, setKeeping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sel, setSel] = useState<string | null>(null)

  // Without the shared-data cloud there is nowhere to send baskets.
  if (!getClient()) return <>{children}</>

  async function run(action: () => ReturnType<typeof sendBasket>, feel: Parameters<typeof haptic>[0]) {
    if (busy) return
    setBusy(true)
    setError("")
    haptic(feel)
    const r = await action()
    setBusy(false)
    if (!r.ok) {
      setError(r.error)
      haptic("warn")
      return
    }
    window.dispatchEvent(new Event("poolean-refresh"))
  }

  if (keeping) {
    const col = {
      game,
      state,
      sel,
      setSel,
      pops,
      add: (pid: string, pts: number) => void run(() => sendBasket(game.id, pid, pts), pts === 3 ? "medium" : pts === 2 ? "light" : "tick"),
    }
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-xs text-muted-foreground">You are keeping score. Tap a player, then 1, 2 or 3. Everyone watching sees it within a moment.</p>
        <div className="grid grid-cols-2 gap-3">
          <TeamColumn side="A" ids={game.teamA} total={a} other={b} {...col} />
          <TeamColumn side="B" ids={game.teamB} total={b} other={a} {...col} />
        </div>
        {error && (
          <p role="alert" className="text-center text-sm text-neg">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" disabled={busy || !(game.scorekeeperScores ?? []).length} onClick={() => void run(() => undoBasket(game.id), "tick")}>
            <Undo2 /> Undo last added
          </Button>
          <Button variant="ghost" className="h-12" onClick={() => setKeeping(false)}>
            Stop keeping score
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {children}
      <Button variant="outline" onClick={() => setKeeping(true)}>
        <PenLine aria-hidden /> Keep score
      </Button>
    </div>
  )
}
