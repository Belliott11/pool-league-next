import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WatchTime } from "@/components/WatchTime"
import { playerName } from "@/lib/players"
import { replaySteps } from "@/lib/replay"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

// The game, shot by shot, on one court with a net at each end: Team A shoots at the bottom net, Team B at the top one. Both teams share the
// whole court: a spot is measured from the team's own net, so Team B's spots are turned round and a long shot reaches past halfway. Each shot lands where it was taken (filled for a make, a ring for a miss,
// in its team's colour), with the score after it. Play runs through it; the arrows and the slider step by hand. src/lib/replay.ts orders
// the shots.

const W = 300
const H = 420
const P = 8
const L = H - P * 2 // the court's length
const X = (v: number) => P + (v / 100) * (W - P * 2)
// A spot in court terms (0..100 across, 0..100 out from the net) for the team taking it: from the bottom net for Team A, from the top net
// (turned round) for Team B.
const spot = (side: "A" | "B" | null, at: { x: number; y: number }) =>
  side === "B" ? { cx: X(100 - at.x), cy: P + (at.y / 100) * L } : { cx: X(at.x), cy: H - P - (at.y / 100) * L }
const color = (side: "A" | "B" | null) => (side === "B" ? "var(--color-team-b)" : side === "A" ? "var(--color-team-a)" : "currentColor")

export function GameReplay({ state, game }: { state: PooleanState; game: Game }) {
  const steps = useMemo(() => replaySteps(game), [game])
  const [at, setAt] = useState(0) // how many shots are shown
  const [playing, setPlaying] = useState(false)
  const [fast, setFast] = useState(false)
  useEffect(() => {
    if (!playing) return
    if (at >= steps.length) {
      setPlaying(false)
      return
    }
    const t = setTimeout(() => setAt((n) => n + 1), fast ? 450 : 1000)
    return () => clearTimeout(t)
  }, [playing, at, steps.length, fast])
  if (!steps.length) return null
  const last = at > 0 ? steps[at - 1] : null
  const shown = steps.slice(0, at)
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  const what = (s: typeof last) =>
    !s ? "Tip-off." : `${playerName(state, s.scorerId)} ${s.made ? "makes" : "misses"} ${s.points === 1 ? "a free throw" : `a ${s.points}`}${s.made && s.assistId ? `, from ${playerName(state, s.assistId)}` : ""}.`
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <span className={cn("min-w-0 truncate", TEAM.A.text)}>{names(game.teamA)}</span>
        <span className="shrink-0 font-display text-2xl font-bold tabular-nums" aria-live="polite">
          {last?.a ?? 0}-{last?.b ?? 0}
        </span>
        <span className={cn("min-w-0 truncate text-right", TEAM.B.text)}>{names(game.teamB)}</span>
      </div>
      <div className="mx-auto w-full max-w-xs">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border bg-card" role="img" aria-label={`Shot ${at} of ${steps.length}. ${what(last)} Score ${last?.a ?? 0} to ${last?.b ?? 0}.`}>
          <rect x={P} y={P} width={W - P * 2} height={H - P * 2} rx={4} className="fill-none stroke-foreground/40" />
          {/* Each net's 3-point range: 60% of the court out from it. */}
          <line x1={P} x2={W - P} y1={H - P - 0.6 * L} y2={H - P - 0.6 * L} stroke="var(--color-team-a)" strokeOpacity="0.5" strokeDasharray="4 4" />
          <line x1={P} x2={W - P} y1={P + 0.6 * L} y2={P + 0.6 * L} stroke="var(--color-team-b)" strokeOpacity="0.5" strokeDasharray="4 4" />
          {/* The nets: a backboard behind each rim, so a rim never reads as a missed shot, in the colour of the team shooting at it. */}
          <line x1={W / 2 - 16} x2={W / 2 + 16} y1={H - P - 4} y2={H - P - 4} className="stroke-foreground/70" strokeWidth={3} />
          <circle cx={W / 2} cy={H - P - 13} r={6} fill="none" stroke="var(--color-team-a)" strokeWidth={2.5} />
          <line x1={W / 2 - 16} x2={W / 2 + 16} y1={P + 4} y2={P + 4} className="stroke-foreground/70" strokeWidth={3} />
          <circle cx={W / 2} cy={P + 13} r={6} fill="none" stroke="var(--color-team-b)" strokeWidth={2.5} />
          {shown.map((s, i) =>
            s.at ? (
              <circle
                key={s.id}
                {...spot(s.side, s.at)}
                r={i === at - 1 ? 8 : 5}
                fill={s.made ? color(s.side) : "none"}
                stroke={color(s.side)}
                strokeWidth={s.made ? 1 : 2}
              />
            ) : null,
          )}
          {last?.at && (() => {
            const p = spot(last.side, last.at)
            return <circle {...p} r={14} fill="none" stroke={color(last.side)} strokeWidth={2} className="motion-safe:animate-ping" style={{ transformOrigin: `${p.cx}px ${p.cy}px` }} />
          })()}
        </svg>
      </div>
      <p className="min-h-10 text-center">
        {what(last)}
        {last && last.videoTime !== null && (
          <>
            {" "}
            <WatchTime t={last.videoTime} />
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button size="icon" variant="outline" aria-label="Back one shot" disabled={at === 0} onClick={() => (setPlaying(false), setAt(at - 1))}>
          <ChevronLeft />
        </Button>
        <Button
          onClick={() => {
            if (at >= steps.length) setAt(0)
            setPlaying(!playing)
          }}
        >
          {playing ? <Pause aria-hidden /> : at >= steps.length ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
          {playing ? "Pause" : at >= steps.length ? "Again" : at === 0 ? "Play the game" : "Play"}
        </Button>
        <Button size="icon" variant="outline" aria-label="Forward one shot" disabled={at >= steps.length} onClick={() => (setPlaying(false), setAt(at + 1))}>
          <ChevronRight />
        </Button>
        <Button size="sm" variant="ghost" aria-pressed={fast} onClick={() => setFast(!fast)}>
          {fast ? "2x" : "1x"}
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">
          Shot {at} of {steps.length}
        </span>
        <input type="range" min={0} max={steps.length} value={at} onChange={(e) => (setPlaying(false), setAt(Number(e.target.value)))} className="flex-1 accent-[var(--color-primary)]" aria-label="Move through the shots" />
      </label>
      <p className="text-xs text-muted-foreground">
        One court, a net at each end: Team A shoots at the bottom net, Team B at the top one, and the dashed line in each team's colour is its 3-point
        range. Filled dots are makes, rings are misses. Free throws and shots with no spot logged only move the score.
      </p>
    </div>
  )
}
