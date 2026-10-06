import { Flag, Minus, PenLine, Plus, Undo2 } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { haptic } from "@/lib/haptics"
import { uid } from "@/lib/format"
import { DEFAULT_TARGET } from "@/lib/live"
import { finishGame, sendBasket, startGame, undoBasket } from "@/lib/scorekeeper"
import { liveScoreOf } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"
import { TeamColumn, type Pop } from "./LiveGamePage"

// For anyone watching a live game who wants to help keep score: tap Keep score, then add baskets. It shows
// the scoreboard in place of the read-only view while it is on. No sign-in or code.
type Pending = { bid: string; pid: string; points: number }

export function Scorekeeper({ game, state, pops, a, b, children }: { game: Game; state: PooleanState; pops: Pop[]; a: number; b: number; children: ReactNode }) {
  const [keeping, setKeeping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [sel, setSel] = useState<string | null>(null)
  // Baskets tapped here show on the scoreboard right away, then go out one at a time, in order. A basket that cannot
  // be sent (no signal) stays queued and is retried, so a spotty connection never loses a score. Each carries an id so
  // a retry the server already received is not counted twice.
  const [queue, setQueue] = useState<Pending[]>([])
  const sending = useRef(false)
  const [offline, setOffline] = useState(false)
  const seen = new Set((game.scorekeeperScores ?? []).map((s) => s.bid))
  const waiting = queue.filter((p) => !seen.has(p.bid))

  // Drops a basket from the queue once the shared copy shows it.
  useEffect(() => {
    if (queue.some((p) => seen.has(p.bid))) setQueue((q) => q.filter((p) => !seen.has(p.bid)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.scorekeeperScores])

  const sentRef = useRef(new Set<string>())
  useEffect(() => {
    if (sending.current) return
    const next = queue.find((p) => !sentRef.current.has(p.bid))
    if (!next) return
    sending.current = true
    let timer: ReturnType<typeof setTimeout> | undefined
    void sendBasket(game.id, next.pid, next.points, next.bid).then((r) => {
      sending.current = false
      if (r.ok) {
        sentRef.current.add(next.bid)
        setOffline(false)
        setError("")
        window.dispatchEvent(new Event("poolean-refresh"))
        setQueue((q) => [...q]) // wake the loop for the next basket
      } else if (r.retry) {
        setOffline(true)
        setError(r.error)
        timer = setTimeout(() => setQueue((q) => [...q]), 2500)
      } else {
        // The server said no (the game ended, for example): this basket will never be accepted.
        setError(r.error)
        haptic("warn")
        setQueue((q) => q.filter((p) => p.bid !== next.bid))
      }
    })
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue])

  // Closing the page with baskets still waiting would lose them.
  useEffect(() => {
    if (waiting.length === 0) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [waiting.length])

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
    // The scoreboard shows the basket right away, before the server has confirmed it.
    const shown: Game = { ...game, liveScores: [...(game.liveScores ?? []), ...waiting] }
    const side = (ids: string[]) => liveScoreOf(shown, ids)
    const col = {
      game: shown,
      state,
      sel,
      setSel,
      pops,
      add: (pid: string, pts: number) => {
        haptic(pts === 3 ? "medium" : pts === 2 ? "light" : "tick")
        setQueue((q) => [...q, { bid: uid("b"), pid, points: pts }])
      },
    }
    return (
      <div className="flex flex-col gap-3">
        <p className="text-center text-xs text-muted-foreground">You are keeping score. Tap a player, then 1, 2 or 3. Everyone watching sees it within a moment.</p>
        <div className="grid grid-cols-2 gap-3">
          <TeamColumn side="A" ids={game.teamA} total={side(game.teamA)} other={side(game.teamB)} {...col} />
          <TeamColumn side="B" ids={game.teamB} total={side(game.teamB)} other={side(game.teamA)} {...col} />
        </div>
        {waiting.length > 0 && (
          <p role="status" className="text-center text-xs text-muted-foreground">
            {offline ? "No signal. " : ""}{waiting.length} basket{waiting.length === 1 ? "" : "s"} sending{offline ? ", will keep trying" : ""}.
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-sm text-neg">
            {error}
          </p>
        )}
        <Button
          className="h-12"
          disabled={busy || waiting.length > 0 || (a === 0 && b === 0)}
          onClick={() => {
            if (confirm(`Finish the game at ${side(game.teamA)} to ${side(game.teamB)}? It is saved to the game list.`)) void run(() => finishGame(game.id), "success").then(() => setKeeping(false))
          }}
        >
          <Flag /> Finish game
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-12"
            disabled={busy || (!(game.scorekeeperScores ?? []).length && waiting.length === 0)}
            onClick={() => {
              // A basket that has not gone out yet is simply cancelled; otherwise the last added one is undone on the server.
              const unsent = [...queue].reverse().find((p) => !sentRef.current.has(p.bid) && !seen.has(p.bid))
              if (unsent) return setQueue((q) => q.filter((p) => p.bid !== unsent.bid))
              if (waiting.length > 0) return setError("Wait for the last basket to send, then undo.")
              void run(() => undoBasket(game.id), "tick")
            }}
          >
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
