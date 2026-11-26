import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WatchTime } from "@/components/WatchTime"
import { playerName } from "@/lib/players"
import { replaySteps } from "@/lib/replay"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

// The game, shot by shot, on the court: each shot lands where it was taken (filled for a make, a ring for a miss, in its team's colour),
// with the score after it. Play runs through it; the arrows and the slider step by hand. src/lib/replay.ts orders the shots.

const W = 300
const H = 360
const P = 8
const X = (v: number) => P + (v / 100) * (W - P * 2)
const Y = (v: number) => H - P - (v / 100) * (H - P * 2)
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
          <line x1={P} x2={W - P} y1={Y(60)} y2={Y(60)} className="stroke-foreground/30" strokeDasharray="4 4" />
          <text x={W - P - 4} y={Y(60) - 5} textAnchor="end" fontSize="10" className="fill-muted-foreground">3-point range</text>
          <circle cx={W / 2} cy={Y(7)} r={6} className="fill-none stroke-foreground/60" strokeWidth={2} />
          {shown.map((s, i) =>
            s.at ? (
              <circle
                key={s.id}
                cx={X(s.at.x)}
                cy={Y(s.at.y)}
                r={i === at - 1 ? 8 : 5}
                fill={s.made ? color(s.side) : "none"}
                stroke={color(s.side)}
                strokeWidth={s.made ? 1 : 2}
              />
            ) : null,
          )}
          {last?.at && <circle cx={X(last.at.x)} cy={Y(last.at.y)} r={14} fill="none" stroke={color(last.side)} strokeWidth={2} className="motion-safe:animate-ping" style={{ transformOrigin: `${X(last.at.x)}px ${Y(last.at.y)}px` }} />}
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
      <p className="text-xs text-muted-foreground">Filled dots are makes, rings are misses, in each team's colour. Free throws and shots with no spot logged only move the score.</p>
    </div>
  )
}
