import { Radio } from "lucide-react"
import { useEffect, useRef } from "react"
import { EmptyState } from "@/components/EmptyState"
import { Button } from "@/components/ui/button"
import { haptic } from "@/lib/haptics"
import { findLiveGame, liveTargetOf, liveTotals } from "@/lib/live"
import { playerName } from "@/lib/players"
import { liveScoreOf } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import { Confetti, useScorePops, type Pop } from "./LiveGamePage"
import { LiveOdds, LiveOddsMini } from "./LiveOdds"
import { Scorekeeper } from "./Scorekeeper"

const NONE: Game = { id: "", date: "", teamA: [], teamB: [], stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }

// A prominent card on the Games tab while a game is being scored, so a visitor sees it straight away.
export function LiveBanner({ state, onOpen }: { state: PooleanState; onOpen: () => void }) {
  const g = findLiveGame(state)
  if (!g) return null
  const [a, b] = liveTotals(g)
  return (
    <button type="button" onClick={onOpen} className="flex flex-col gap-2 rounded-xl border-2 border-primary bg-card p-4 text-left">
      <span className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Radio className="size-4 animate-pulse" aria-hidden />
        Live now
      </span>
      <span className="font-display text-3xl tabular-nums">
        {a} <span className="text-muted-foreground">-</span> {b}
      </span>
      <LiveOddsMini game={g} />
      <span className="text-sm text-muted-foreground">Tap to watch. It updates by itself.</span>
    </button>
  )
}

function Side({ side, ids, total, other, game, state, pops }: { side: "A" | "B"; ids: string[]; total: number; other: number; game: Game; state: PooleanState; pops: Pop[] }) {
  const scored = pops.some((p) => ids.includes(p.pid))
  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label={`Team ${side}`}>
      <div className={cn("rounded-xl border-2 p-3 text-center transition-colors duration-300", total > other ? cn(TEAM[side].border, TEAM[side].tint) : "border-border bg-card")}>
        <div className={cn("text-xs font-semibold uppercase tracking-wide", TEAM[side].text)}>Team {side}</div>
        <div key={total} className={cn("font-display text-6xl leading-none tabular-nums", scored && "anim-bump")}>
          {total}
        </div>
      </div>
      {ids.map((id) => {
        const mine = pops.filter((p) => p.pid === id)
        const pts = liveScoreOf(game, [id])
        return (
          <div key={id} className="relative flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
            {mine.map((p) => (
              <span key={p.key} aria-hidden className={cn("anim-flash pointer-events-none absolute inset-0 rounded-lg ring-2", p.points === 3 ? "ring-gold" : "ring-primary")} />
            ))}
            {mine.map((p) => (
              <span key={`n${p.key}`} aria-hidden className={cn("anim-pop-float pointer-events-none absolute right-2 top-0 z-10 font-display font-extrabold", p.points === 3 ? "text-3xl text-gold" : "text-2xl text-primary")}>
                +{p.points}
              </span>
            ))}
            <span className="truncate font-medium">{playerName(state, id)}</span>
            <span key={pts} className={cn("font-display text-2xl tabular-nums", mine.length > 0 && "anim-bump")}>
              {pts}
            </span>
          </div>
        )
      })}
    </section>
  )
}

// The live scoreboard for anyone who is not the editor: the same score, odds and effects, with no buttons.
// It follows whatever the editor is scoring; the data refreshes every few seconds.
export function LiveWatch({ state, onClose }: { state: PooleanState; onClose: () => void }) {
  const live = findLiveGame(state)
  // Remember the game so that when it ends the final score stays on screen instead of vanishing.
  const lastId = useRef<string | undefined>(live?.id)
  if (live) lastId.current = live.id
  const game = live ?? state.games.find((g) => g.id === lastId.current)
  const shown = game ?? NONE
  const pops = useScorePops(shown)
  const seen = useRef(pops.length)
  useEffect(() => {
    if (pops.length > seen.current) haptic("tick")
    seen.current = pops.length
  }, [pops.length])

  const [a, b] = liveTotals(shown)
  const target = liveTargetOf(shown)
  const over = a >= target || b >= target
  const wasOver = useRef(over)
  useEffect(() => {
    if (shown.id && over && !wasOver.current) haptic("success")
    wasOver.current = over
  }, [over, shown.id])

  if (!game) {
    return (
      <EmptyState
        title="No live game right now"
        hint="When a game is being scored it shows up here and updates by itself."
        action={<Button onClick={onClose}>Back to games</Button>}
      />
    )
  }

  const isLive = !!game.liveInProgress
  const last = [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])].at(-1)
  const hint = !isLive
    ? `Final: Team ${a > b ? "A" : b > a ? "B" : "A and B tied"}${a === b ? "" : " won"}, ${a} to ${b}.`
    : over && a === b
      ? `Tied at ${a}.`
      : over
        ? `Team ${a > b ? "A" : "B"} reached ${target}.`
        : a === b
          ? `Tied. First to ${target}.`
          : `Team ${a > b ? "A" : "B"} leads by ${Math.abs(a - b)}. ${target - Math.max(a, b)} to go.`

  return (
    <div data-no-swipe className="mx-auto flex w-full max-w-md flex-col gap-3">
      {isLive && over && a !== b && <Confetti />}
      <div className="flex items-center justify-between gap-2">
        <span className={cn("flex items-center gap-1.5 text-sm font-semibold", isLive ? "text-primary" : "text-muted-foreground")}>
          <Radio className={cn("size-4", isLive && "animate-pulse")} aria-hidden />
          {isLive ? "Live" : "Final"}
        </span>
        <span className="text-xs text-muted-foreground">{isLive ? "Updates by itself every few seconds" : "This game has ended"}</span>
      </div>
      <p className={cn("rounded-lg px-3 py-2 text-center text-sm font-medium", !isLive && a !== b ? "bg-pos text-white" : "bg-muted")} role="status">
        {hint}
      </p>
      {isLive ? (
        <Scorekeeper game={game} state={state} pops={pops} a={a} b={b}>
        <div className="grid grid-cols-2 gap-3">
          <Side side="A" ids={game.teamA} total={a} other={b} game={game} state={state} pops={pops} />
          <Side side="B" ids={game.teamB} total={b} other={a} game={game} state={state} pops={pops} />
        </div>
        </Scorekeeper>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Side side="A" ids={game.teamA} total={a} other={b} game={game} state={state} pops={pops} />
          <Side side="B" ids={game.teamB} total={b} other={a} game={game} state={state} pops={pops} />
        </div>
      )}
      {last && (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          Last score: {playerName(state, last.pid)} +{last.points}
        </p>
      )}
      {isLive && <LiveOdds game={game} />}
      <Button variant="ghost" onClick={onClose}>
        Back to games
      </Button>
    </div>
  )
}
