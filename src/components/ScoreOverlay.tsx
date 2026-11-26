import { useEffect, useMemo, useState, type MutableRefObject, type ReactNode } from "react"
import type { PlayerControl } from "@/components/YouTubePlayer"
import { oddsTimeline } from "@/lib/oddsTimeline"
import { playerName } from "@/lib/players"
import { scoreAt, type ScoreNow } from "@/lib/scoreAt"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

// A broadcast-style score bug over the game video: the score as the video plays, updating as each basket goes in, with who scored and a
// bar for Team A's live win chance. Only for games whose shots have video times (stat entry, or live baskets placed in the recording).
// It takes no taps, and a switch under the video hides it (remembered on this phone).
const KEY = "pooleanScoreOverlay"

export function ScoreOverlay({ state, game, control, children }: { state: PooleanState; game: Game; control?: MutableRefObject<PlayerControl | null>; children: ReactNode }) {
  const t = useMemo(() => oddsTimeline(game), [game])
  const timed = t.steps.some((s) => s.videoTime !== null)
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(KEY) !== "off"
    } catch {
      return true
    }
  })
  const [now, setNow] = useState<ScoreNow | null>(null)
  useEffect(() => {
    if (!timed || !on || !control) return
    const id = setInterval(() => setNow(scoreAt(t.steps, t.start, control.current?.time() ?? -1)), 250)
    return () => clearInterval(id)
  }, [timed, on, control, t])
  const toggle = () => {
    setOn(!on)
    try {
      localStorage.setItem(KEY, on ? "off" : "on")
    } catch {
      /* not remembered */
    }
  }
  if (!timed || !control) return <>{children}</>
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        {children}
        {on && now && (
          <div aria-hidden className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1 rounded-lg bg-black/70 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm sm:left-3 sm:top-3">
            <div className="flex items-center gap-2 font-display text-lg font-bold tabular-nums leading-none sm:text-xl">
              <span className="size-2 rounded-full bg-[var(--color-team-a)]" />
              <span className={cn("transition-transform", now.fresh && now.last?.side === "A" && "scale-125")}>{now.a}</span>
              <span className="text-white/60">-</span>
              <span className={cn("transition-transform", now.fresh && now.last?.side === "B" && "scale-125")}>{now.b}</span>
              <span className="size-2 rounded-full bg-[var(--color-team-b)]" />
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-team-b)]">
              <div className="h-full bg-[var(--color-team-a)] transition-[width] duration-500" style={{ width: `${Math.round(now.odds * 100)}%` }} />
            </div>
            {now.fresh && now.last && (
              <span className="max-w-40 truncate text-[11px] leading-tight text-white/90">
                {playerName(state, now.last.scorerId)} +{now.last.points}
              </span>
            )}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 self-start text-xs text-muted-foreground">
        <input type="checkbox" checked={on} onChange={toggle} className="accent-[var(--color-primary)]" />
        Score on the video
      </label>
    </div>
  )
}
