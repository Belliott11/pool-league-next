import { useState } from "react"
import { Minus, Plus, Undo2, Flag, X, UserPlus } from "lucide-react"
import { EmptyState } from "@/components/EmptyState"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uid } from "@/lib/format"
import {
  DEFAULT_TARGET, addLiveScore, discardLive, finishLive, findLiveGame, liveTargetOf, liveTotals, startLive, undoLiveScore,
} from "@/lib/live"
import { playerName } from "@/lib/players"
import { liveScoreOf } from "@/lib/stats"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

function Setup({ state, update, onClose }: { state: PooleanState; update: Update; onClose: () => void }) {
  const [teamA, setA] = useState<string[]>([])
  const [teamB, setB] = useState<string[]>([])
  const [target, setTarget] = useState(DEFAULT_TARGET)
  const [name, setName] = useState("")

  // Tapping a team button moves the player there; tapping it again takes them off.
  function assign(id: string, side: "A" | "B") {
    const was = (side === "A" ? teamA : teamB).includes(id)
    setA((t) => t.filter((x) => x !== id))
    setB((t) => t.filter((x) => x !== id))
    if (!was) (side === "A" ? setA : setB)((t) => [...t, id])
  }

  function addPlayer() {
    const n = name.trim()
    if (!n) return
    update((s) => ({ ...s, players: [...s.players, { id: uid("player"), name: n }] }))
    setName("")
  }

  const ok = teamA.length > 0 && teamB.length > 0
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl">Start a live game</h2>
      {state.players.length === 0 && <EmptyState title="No players yet" hint="Add a player below." />}
      <div className="flex flex-col gap-2">
        {state.players.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border p-2">
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            {(["A", "B"] as const).map((side) => {
              const on = (side === "A" ? teamA : teamB).includes(p.id)
              return (
                <Button
                  key={side}
                  className="h-11 w-14"
                  variant={on ? "default" : "outline"}
                  aria-pressed={on}
                  aria-label={`${p.name} on team ${side}`}
                  onClick={() => assign(p.id, side)}
                >
                  {side}
                </Button>
              )
            })}
          </div>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          addPlayer()
        }}
      >
        <Input className="h-11" placeholder="New player name" aria-label="New player name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="outline" className="h-11" aria-label="Add player">
          <UserPlus />
        </Button>
      </form>
      <div className="flex items-center justify-between rounded-lg border p-2">
        <span className="font-medium">Play to</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="size-11" aria-label="Lower target" onClick={() => setTarget((t) => Math.max(1, t - 1))}>
            <Minus />
          </Button>
          <span className="w-10 text-center font-display text-2xl tabular-nums">{target}</span>
          <Button variant="outline" className="size-11" aria-label="Raise target" onClick={() => setTarget((t) => t + 1)}>
            <Plus />
          </Button>
        </div>
      </div>
      <Button
        className="h-14 text-lg"
        disabled={!ok}
        onClick={() => update((s) => startLive(s, uid("game"), new Date().toISOString().slice(0, 10), teamA, teamB, target))}
      >
        Start game
      </Button>
      {!ok && <p className="text-center text-xs text-muted-foreground">Put at least one player on each team.</p>}
      <Button variant="ghost" onClick={onClose}>
        Back to games
      </Button>
    </div>
  )
}

function TeamColumn({ side, ids, total, other, game, state, sel, setSel, add }: {
  side: "A" | "B"
  ids: string[]
  total: number
  other: number
  game: Game
  state: PooleanState
  sel: string | null
  setSel: (id: string | null) => void
  add: (pid: string, pts: number) => void
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={`Team ${side}`}>
      <div className={cn("rounded-xl border-2 p-3 text-center", total > other ? "border-accent bg-accent/15" : "border-border bg-card")}>
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team {side}</div>
        <div className="font-display text-6xl leading-none tabular-nums">{total}</div>
      </div>
      {ids.map((id) => {
        const on = sel === id
        const name = playerName(state, id)
        return (
          <div key={id} className={cn("rounded-lg border p-2", on ? "border-accent bg-accent/15" : "bg-card")}>
            <button type="button" aria-pressed={on} className="flex min-h-11 w-full items-center justify-between gap-2 text-left" onClick={() => setSel(on ? null : id)}>
              <span className="truncate font-medium">{name}</span>
              <span className="font-display text-2xl tabular-nums">{liveScoreOf(game, [id])}</span>
            </button>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {[1, 2, 3].map((p) => (
                <Button key={p} className="h-12 px-0 text-base" variant={on ? "default" : "outline"} aria-label={`${name} plus ${p}`} onClick={() => add(id, p)}>
                  +{p}
                </Button>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

function Board({ game, state, update, onClose }: { game: Game; state: PooleanState; update: Update; onClose: () => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [a, b] = liveTotals(game)
  const target = liveTargetOf(game)
  const over = a >= target || b >= target
  const hint = over
    ? `Team ${a > b ? "A" : "B"} reached ${target}. Finish the game.`
    : a === b
      ? `Tied. First to ${target}.`
      : `Team ${a > b ? "A" : "B"} leads by ${Math.abs(a - b)}. ${target - Math.max(a, b)} to go.`

  const add = (pid: string, pts: number) => update((s) => addLiveScore(s, game.id, pid, pts))
  const col = { game, state, sel, setSel, add }

  return (
    <div className="flex flex-col gap-3">
      <p className={cn("rounded-lg px-3 py-2 text-center text-sm font-medium", over ? "bg-pos text-white" : "bg-muted")} role="status">
        {hint}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TeamColumn side="A" ids={game.teamA} total={a} other={b} {...col} />
        <TeamColumn side="B" ids={game.teamB} total={b} other={a} {...col} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12" disabled={!(game.liveScores ?? []).length} onClick={() => update((s) => undoLiveScore(s, game.id))}>
          <Undo2 /> Undo last
        </Button>
        <Button
          className="h-12"
          onClick={() => {
            update((s) => finishLive(s, game.id))
            onClose()
          }}
        >
          <Flag /> Finish game
        </Button>
      </div>
      {confirm ? (
        <div className="flex flex-col gap-2 rounded-lg border border-neg p-3">
          <p className="text-sm">Discard this game and all its scores?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11" onClick={() => setConfirm(false)}>
              Keep playing
            </Button>
            <Button
              className="h-11 bg-neg text-white"
              onClick={() => {
                update((s) => discardLive(s, game.id))
                onClose()
              }}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="h-11 text-neg" onClick={() => setConfirm(true)}>
          <X /> Discard game
        </Button>
      )}
      <Button variant="ghost" onClick={onClose}>
        Back to games
      </Button>
    </div>
  )
}

export function LiveGamePage({ state, update, onClose }: { state: PooleanState; update: Update; onClose: () => void }) {
  const game = findLiveGame(state)
  return (
    <div className="mx-auto w-full max-w-md">
      {game ? <Board game={game} state={state} update={update} onClose={onClose} /> : <Setup state={state} update={update} onClose={onClose} />}
    </div>
  )
}
