import { KeyRound, Undo2 } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getClient } from "@/lib/cloud"
import { haptic } from "@/lib/haptics"
import { checkScorekeeperCode, getScorekeeperCode, sendBasket, setScorekeeperCode, undoBasket } from "@/lib/scorekeeper"
import type { Game, PooleanState } from "@/lib/types"
import { TeamColumn, type Pop } from "./LiveGamePage"

// For a friend who is not an editor but is keeping score: unlock with the shared code, then add baskets
// to the live game. It shows the scoreboard in place of the read-only view while it is on.
export function Scorekeeper({ game, state, pops, a, b, children }: { game: Game; state: PooleanState; pops: Pop[]; a: number; b: number; children: ReactNode }) {
  const [keeping, setKeeping] = useState(false)
  const [asking, setAsking] = useState(false)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sel, setSel] = useState<string | null>(null)

  // Without the shared-data cloud there is nowhere to send baskets.
  if (!getClient()) return <>{children}</>

  async function unlock() {
    setBusy(true)
    setError("")
    const r = await checkScorekeeperCode(code)
    setBusy(false)
    if (r.ok) {
      setAsking(false)
      setKeeping(true)
      setCode("")
    } else setError(r.error)
  }

  function start() {
    if (getScorekeeperCode()) setKeeping(true)
    else setAsking(true)
  }

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
            <Undo2 /> Undo my last
          </Button>
          <Button variant="ghost" className="h-12" onClick={() => setKeeping(false)}>
            Stop keeping score
          </Button>
        </div>
        <button
          type="button"
          className="self-center text-xs text-muted-foreground underline"
          onClick={() => {
            setScorekeeperCode("")
            setKeeping(false)
          }}
        >
          Forget the code on this device
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {children}
      {asking ? (
        <form
          className="flex flex-col gap-2 rounded-xl border bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault()
            void unlock()
          }}
        >
          <label className="text-sm font-medium" htmlFor="scorekeeper-code">
            Scorekeeper code
          </label>
          <p className="text-xs text-muted-foreground">Ask the league editor for it. It only lets you add baskets to the game that is live.</p>
          <Input id="scorekeeper-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" />
          {error && (
            <p role="alert" className="text-xs text-neg">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !code.trim()}>
              {busy ? "Checking" : "Unlock"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={start}>
          <KeyRound aria-hidden /> Keep score
        </Button>
      )}
    </div>
  )
}
