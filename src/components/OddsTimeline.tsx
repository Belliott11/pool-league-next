import { useEffect, useMemo, useRef, useState } from "react"
import { useHeaderHeight } from "@/components/PageTabs"
import { WatchTime } from "@/components/WatchTime"
import { bigSwings, oddsTimeline, type OddsStep } from "@/lib/oddsTimeline"
import { playerName } from "@/lib/players"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

// The game page's Odds tab: Team A's win chance through the game, pinned at the top, and every basket below it with how far it moved the
// odds. Scrolling the list moves the marker on the chart to the basket in the middle of the screen; tapping a row does the same.

const pct = (p: number) => `${Math.round(p * 100)}%`
const W = 360
const H = 120
const PAD = 8

function Chart({ start, steps, at, teamA, teamB }: { start: number; steps: OddsStep[]; at: number; teamA: string; teamB: string }) {
  const pts = [start, ...steps.map((s) => s.after)]
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / Math.max(1, pts.length - 1)
  const y = (p: number) => PAD + (1 - p) * (H - 2 * PAD)
  const cur = at + 1 // the point after the active basket (0 is the tip)
  const line = pts.map((p, i) => `${x(i)},${y(p)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={`Team A's win chance through the game, from ${pct(start)} at the tip. Basket ${at + 1} of ${steps.length} is marked: ${pct(pts[cur])} after it.`}>
      <text x={PAD} y={PAD + 8} fontSize="9" fill="currentColor" fillOpacity="0.75">Team A ({teamA})</text>
      <text x={PAD} y={H - PAD - 2} fontSize="9" fill="currentColor" fillOpacity="0.75">Team B ({teamB})</text>
      <line x1={PAD} x2={W - PAD} y1={y(0.5)} y2={y(0.5)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 3" />
      <polyline points={line} fill="none" stroke="var(--color-team-a)" strokeWidth="2" strokeLinejoin="round" strokeOpacity="0.35" />
      {/* The game so far, up to the marked basket, drawn solid. */}
      <polyline points={pts.slice(0, cur + 1).map((p, i) => `${x(i)},${y(p)}`).join(" ")} fill="none" stroke="var(--color-team-a)" strokeWidth="2.5" strokeLinejoin="round" />
      <line x1={x(cur)} x2={x(cur)} y1={PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.3" />
      <circle cx={x(cur)} cy={y(pts[cur])} r="5" fill="currentColor" />
    </svg>
  )
}

function Row({ state, game, s, big, active, onPick }: { state: PooleanState; game: Game; s: OddsStep; big: boolean; active: boolean; onPick: () => void }) {
  const forScorer = (p: number) => (s.side === "A" ? p : 1 - p)
  const move = Math.round((forScorer(s.after) - forScorer(s.before)) * 100)
  const who = playerName(state, s.scorerId)
  void game
  return (
    <li data-step={s.index}>
      {/* Scrolling picks the row; a tap does too. The row holds the Watch button, so it is not a button itself. */}
      <div
        aria-current={active ? "step" : undefined}
        onClick={onPick}
        className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors", active ? "border-foreground bg-muted" : "border-transparent")}
      >
      <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", TEAM[s.side].dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div>
          <span className={cn("font-semibold", TEAM[s.side].text)}>{who}</span> {s.ends ? "wins it with" : "makes"} a {s.points}
          {s.assistId ? <span className="text-muted-foreground">, from {playerName(state, s.assistId)}</span> : null}
          {big && <span className="ml-2 rounded-full border px-1.5 text-xs font-medium">Big swing</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {s.a}-{s.b}. Team A {pct(s.before)} to {pct(s.after)}
          {s.videoTime !== null && (
            <>
              {" "}
              <WatchTime t={s.videoTime} />
            </>
          )}
        </div>
      </div>
      <span className={cn("shrink-0 font-display text-lg tabular-nums", move >= 10 && "font-bold")}>+{move}</span>
      </div>
    </li>
  )
}

export function OddsTimelineCard({ state, game }: { state: PooleanState; game: Game }) {
  const t = useMemo(() => oddsTimeline(game), [game])
  const big = useMemo(() => bigSwings(t), [t])
  const [at, setAt] = useState(0)
  const list = useRef<HTMLOListElement>(null)
  const top = useHeaderHeight()
  // The row nearest the middle of the screen is the one the chart marks.
  useEffect(() => {
    const el = list.current
    if (!el || typeof IntersectionObserver === "undefined") return
    const seen = new Map<number, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(Number((e.target as HTMLElement).dataset.step), e.isIntersecting)
        const visible = [...seen].filter(([, v]) => v).map(([k]) => k)
        if (visible.length) setAt(Math.min(...visible))
      },
      { rootMargin: "-45% 0px -45% 0px" },
    )
    el.querySelectorAll("[data-step]").forEach((r) => io.observe(r))
    return () => io.disconnect()
  }, [t])
  if (!t.steps.length) return <p className="text-sm text-muted-foreground">The odds fill in as baskets are scored.</p>
  const s = t.steps[Math.min(at, t.steps.length - 1)]
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div style={{ top }} className="sticky z-10 -mx-1 rounded-xl border bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Tip: Team A {pct(t.start)}. First to {t.target}, win by 2.
          </span>
          <span className="font-medium text-foreground tabular-nums">
            {s.a}-{s.b}, Team A {pct(s.after)}
          </span>
        </div>
        <Chart start={t.start} steps={t.steps} at={at} teamA={names(game.teamA)} teamB={names(game.teamB)} />
      </div>
      <ol ref={list} className="flex flex-col gap-1">
        {t.steps.map((step) => (
          <Row key={step.index} state={state} game={game} s={step} big={big.has(step.index)} active={step.index === at} onPick={() => setAt(step.index)} />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        The live odds from the screen everyone watched: the pre-game read from the nights before, then the race to {t.target} as the baskets came. The number on the right is how many
        points of win chance the basket gave the scoring team. How it works is on the How the numbers work page.
      </p>
    </div>
  )
}
