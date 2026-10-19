import { X } from "lucide-react"
import { useEffect } from "react"
import { liveProbHistory, liveTargetOf, liveTotals, liveWinProbability } from "@/lib/live"
import { playerName } from "@/lib/players"
import { liveScoreOf } from "@/lib/stats"
import { TEAM } from "@/lib/teamColors"
import type { Game, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// A big read-only scoreboard for a TV or a propped-up phone. It fills the screen and follows the same live data.
export function TvBoard({ game, state, onClose }: { game: Game; state: PooleanState; onClose: () => void }) {
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", esc)
    return () => {
      window.removeEventListener("keydown", esc)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [onClose])

  const [a, b] = liveTotals(game)
  const target = liveTargetOf(game)
  const { pA } = liveWinProbability(game)
  const pctA = Math.round(pA * 100)
  const live = !!game.liveInProgress
  const last = [...(game.liveScores ?? []), ...(game.scorekeeperScores ?? [])].at(-1)
  const moved = liveProbHistory(game).length > 1

  const side = (s: "A" | "B", ids: string[], total: number) => (
    <section aria-label={`Team ${s}`} className={cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-[2vmin] rounded-3xl border-4 p-[2vmin]", !live && total > (s === "A" ? b : a) && "anim-sheen", total > (s === "A" ? b : a) ? cn(TEAM[s].border, TEAM[s].tint) : "border-border")}>
      <div className={cn("text-[3vmin] font-semibold", TEAM[s].text)}>Team {s}</div>
      <div key={total} className="anim-bump font-display text-[28vmin] leading-none tabular-nums">{total}</div>
      <ul className="flex flex-wrap justify-center gap-x-[3vmin] gap-y-[0.5vmin] text-[3.2vmin]">
        {ids.map((id) => (
          <li key={id} className="whitespace-nowrap">
            {playerName(state, id)} <span className="font-display tabular-nums text-muted-foreground">{liveScoreOf(game, [id])}</span>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div role="dialog" aria-label="Scoreboard" className="fixed inset-0 z-50 flex flex-col gap-[2vmin] bg-background p-[2vmin]">
      <div className="flex items-center justify-between text-[2.6vmin] text-muted-foreground">
        <span>{live ? `Live, first to ${target}` : "Final"}</span>
        <button type="button" onClick={onClose} aria-label="Close scoreboard" className="flex size-11 items-center justify-center rounded-full border">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 gap-[2vmin]">
        {side("A", game.teamA, a)}
        {side("B", game.teamB, b)}
      </div>
      <div className="flex flex-col gap-[1vmin]" aria-label={`Win probability: Team A ${pctA} percent, Team B ${100 - pctA} percent`}>
        <div className="flex justify-between font-display text-[4vmin] tabular-nums">
          <span className={TEAM.A.text}>{pctA}%</span>
          <span className="text-[2.4vmin] text-muted-foreground">{last ? `Last: ${playerName(state, last.pid)} +${last.points}` : moved ? "" : "Win probability"}</span>
          <span className={TEAM.B.text}>{100 - pctA}%</span>
        </div>
        <div className="flex h-[2vmin] overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className={cn("transition-[width] duration-500", TEAM.A.bg)} style={{ width: `${pctA}%` }} />
          <span className={cn("transition-[width] duration-500", TEAM.B.bg)} style={{ width: `${100 - pctA}%` }} />
        </div>
      </div>
    </div>
  )
}
