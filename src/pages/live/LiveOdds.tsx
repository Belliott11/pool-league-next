import { liveProbHistory, liveWinProbability } from "@/lib/live"
import type { Game } from "@/lib/types"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"

const pct = (p: number) => Math.round(p * 100)

// Each side keeps its own colour; the favored side is full strength and the other is dimmed. Widths ease to each new value.
function Bar({ pA, className }: { pA: number; className?: string }) {
  const a = pct(pA)
  const aFav = pA >= 0.5
  return (
    <div className={cn("flex overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className={cn("transition-[width] duration-500 ease-out", TEAM.A.bg, !aFav && "opacity-50")} style={{ width: `${a}%` }} />
      <span className={cn("transition-[width] duration-500 ease-out", TEAM.B.bg, aFav && "opacity-50")} style={{ width: `${100 - a}%` }} />
    </div>
  )
}

// How the odds have moved with each score: the line sits high when Team A is favored and low when Team B is.
function Momentum({ history }: { history: number[] }) {
  if (history.length < 2) return null
  const W = 200
  const H = 52
  const x = (i: number) => (i / (history.length - 1)) * W
  const y = (p: number) => 5 + (1 - p) * (H - 10)
  const line = history.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ")
  const last = history.length - 1
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-14 w-full" role="img" aria-label="How the win probability has moved with each score">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} strokeDasharray="3 3" className="stroke-border" />
      <path d={line} className="fill-none stroke-primary" strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(history[last])} r={3.5} className="fill-primary stroke-card" strokeWidth={1.5} />
    </svg>
  )
}

// Full panel for the live scoreboard.
export function LiveOdds({ game }: { game: Game }) {
  const { pA, pregameA } = liveWinProbability(game)
  const a = pct(pA)
  const aFav = pA >= 0.5
  return (
    <section className="rounded-xl border bg-card p-3" aria-label="Win probability">
      <div className="flex items-end justify-between">
        <div>
          <div className={cn("font-display text-3xl leading-none tabular-nums", TEAM.A.text, !aFav && "opacity-60")}>{a}%</div>
          <div className={cn("mt-1 text-xs font-medium", TEAM.A.text)}>Team A</div>
        </div>
        <div className="pb-0.5 text-xs font-medium text-muted-foreground">Win probability</div>
        <div className="text-right">
          <div className={cn("font-display text-3xl leading-none tabular-nums", TEAM.B.text, aFav && "opacity-60")}>{100 - a}%</div>
          <div className={cn("mt-1 text-xs font-medium", TEAM.B.text)}>Team B</div>
        </div>
      </div>
      <Bar pA={pA} className="mt-2 h-3" />
      <Momentum history={liveProbHistory(game)} />
      <p className="mt-2 text-xs text-muted-foreground">
        {pregameA === null
          ? "No pre-game read yet, so this follows the score alone."
          : `Before the game: Team A ${pct(pregameA)}%, Team B ${100 - pct(pregameA)}%. The score takes over as a team nears the target.`}
      </p>
    </section>
  )
}

// Small version for the game list: shown on a live game's card so visitors can follow along.
export function LiveOddsMini({ game }: { game: Game }) {
  const { pA } = liveWinProbability(game)
  const a = pct(pA)
  return (
    <div className="flex max-w-xs items-center gap-2 text-xs text-muted-foreground" role="group" aria-label={`Win probability: Team A ${a} percent, Team B ${100 - a} percent`}>
      <span className={cn("tabular-nums", TEAM.A.text)}>A {a}%</span>
      <Bar pA={pA} className="h-1.5 flex-1" />
      <span className={cn("tabular-nums", TEAM.B.text)}>B {100 - a}%</span>
    </div>
  )
}
