import { Flag, Minus, PenLine, Plus, Undo2 } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { haptic } from "@/lib/haptics"
import { uid } from "@/lib/format"
import { DEFAULT_TARGET } from "@/lib/live"
import { finishGame, sendBasket, startGame, undoBasket } from "@/lib/scorekeeper"
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
        <Button
          className="h-12"
          disabled={busy || (a === 0 && b === 0)}
          onClick={() => {
            if (confirm(`Finish the game at ${a} to ${b}? It is saved to the game list.`)) void run(() => finishGame(game.id), "success").then(() => setKeeping(false))
          }}
        >
          <Flag /> Finish game
        </Button>
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

// Shown to anyone when no game is live: pick the teams from the players already in the league and start one.
// (Adding new players is for the editor.)
export function ViewerSetup({ state, onClose }: { state: PooleanState; onClose: () => void }) {
  const [teamA, setA] = useState<string[]>([])
  const [teamB, setB] = useState<string[]>([])
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  function assign(id: string, side: "A" | "B") {
    const was = (side === "A" ? teamA : teamB).includes(id)
    setA((t) => t.filter((x) => x !== id))
    setB((t) => t.filter((x) => x !== id))
    if (!was) (side === "A" ? setA : setB)((t) => [...t, id])
  }

  async function start() {
    setBusy(true)
    setError("")
    haptic("medium")
    const r = await startGame(uid("game"), new Date().toISOString().slice(0, 10), teamA, teamB, target)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    window.dispatchEvent(new Event("poolean-refresh"))
  }

  const ok = teamA.length > 0 && teamB.length > 0
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h2 className="font-display text-xl">No game is live. Start one?</h2>
      <p className="text-sm text-muted-foreground">Pick who is playing. Everyone watching can then follow the score, and anyone can add baskets.</p>
      <div className="flex flex-col gap-2">
        {[...state.players].sort((x, y) => x.name.localeCompare(y.name)).map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            {(["A", "B"] as const).map((side) => {
              const on = (side === "A" ? teamA : teamB).includes(p.id)
              return (
                <Button key={side} className="h-11 w-14" variant={on ? "default" : "outline"} aria-pressed={on} aria-label={`${p.name} on team ${side}`} onClick={() => assign(p.id, side)}>
                  {side}
                </Button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg border p-2">
        <span className="font-medium">Play to</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="size-11" aria-label="Lower target" onClick={() => setTarget((t) => Math.max(1, t - 1))}>
            <Minus />
          </Button>
          <span className="w-10 text-center font-display text-2xl tabular-nums">{target}</span>
          <Button variant="outline" className="size-11" aria-label="Raise target" onClick={() => setTarget((t) => Math.min(99, t + 1))}>
            <Plus />
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-neg">
          {error}
        </p>
      )}
      <Button className="h-14 text-lg" disabled={!ok || busy} onClick={() => void start()}>
        {busy ? "Starting" : "Start game"}
      </Button>
      {!ok && <p className="text-center text-xs text-muted-foreground">Put at least one player on each team.</p>}
      <Button variant="ghost" onClick={onClose}>
        Back to games
      </Button>
    </div>
  )
}
