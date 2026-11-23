import { FlipDigits } from "@/components/FlipDigits"
import { Radio, Rewind, Tv, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { YouTubePlayer, type PlayerControl } from "@/components/YouTubePlayer"
import { youtubeId } from "@/lib/video"
import { liveProbHistory, liveTargetOf, liveTotals, liveWinProbability } from "@/lib/live"
import { playerName } from "@/lib/players"
import { liveScoreOf } from "@/lib/stats"
import { TEAM } from "@/lib/teamColors"
import type { Game, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// A big read-only scoreboard for a TV or a propped-up phone. It fills the screen and follows the same live data. When the game is
// streamed, the stream sits beside the score with instant replay: big buttons, or on a keyboard or TV remote the left arrow (back 10 s),
// Shift and left arrow (back 30 s) and L (back to live).
export function TvBoard({ game, state, onClose }: { game: Game; state: PooleanState; onClose: () => void }) {
  const streamId = game.streamUrl ? youtubeId(game.streamUrl) : null
  const [showStream, setShowStream] = useState(true)
  const stream = useRef<PlayerControl | null>(null)
  const back = (sec: number) => stream.current && stream.current.seek(Math.max(0, stream.current.time() - sec))
  const toLive = () => stream.current?.duration && stream.current.seek(stream.current.duration())
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {})
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft") back(e.shiftKey ? 30 : 10)
      else if (e.key === "l" || e.key === "L") toLive()
    }
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

  // `small`: beside the stream, the numbers shrink so both fit.
  const side = (s: "A" | "B", ids: string[], total: number, small = false) => (
    <section aria-label={`Team ${s}`} className={cn("flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center rounded-3xl border-4", small ? "gap-[1vmin] p-[1.5vmin]" : "gap-[2vmin] p-[2vmin]", !live && total > (s === "A" ? b : a) && "anim-sheen", total > (s === "A" ? b : a) ? cn(TEAM[s].border, TEAM[s].tint) : "border-border")}>
      <div className={cn("text-[3vmin] font-semibold", TEAM[s].text)}>Team {s}</div>
      <div className={cn("leading-none", small ? "text-[12vmin]" : "text-[28vmin]")}>
        <FlipDigits value={total} />
      </div>
      <ul className="flex flex-wrap justify-center gap-x-[3vmin] gap-y-[0.5vmin] text-[3.2vmin]">
        {ids.map((id) => (
          <li key={id} className="whitespace-nowrap">
            {playerName(state, id)} <span className="text-muted-foreground">
              <FlipDigits value={liveScoreOf(game, [id])} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  )

  return (
    <div role="dialog" aria-label="Scoreboard" className="fixed inset-0 z-50 flex flex-col gap-[2vmin] bg-background p-[2vmin]">
      <div className="flex items-center justify-between text-[2.6vmin] text-muted-foreground">
        <span>{live ? `Live, first to ${target}, win by 2` : "Final"}</span>
        <div className="flex items-center gap-2">
          {streamId && (
            <button type="button" onClick={() => setShowStream((v) => !v)} className="flex h-11 items-center gap-2 rounded-full border px-4 text-base" aria-pressed={showStream}>
              <Tv aria-hidden className="size-5" /> {showStream ? "Scores only" : "Show the stream"}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close scoreboard" className="flex size-11 items-center justify-center rounded-full border">
            <X aria-hidden className="size-5" />
          </button>
        </div>
      </div>
      {streamId && showStream ? (
        <div className="flex min-h-0 flex-1 gap-[2vmin] max-md:flex-col">
          <div className="flex min-h-0 min-w-0 flex-[2] flex-col gap-[1.5vmin]">
            <YouTubePlayer id={streamId} control={stream} className="h-full min-h-0 flex-1 [aspect-ratio:auto]" />
            <div className="grid grid-cols-3 gap-[1.5vmin]" role="group" aria-label="Instant replay">
              <button type="button" onClick={() => back(10)} className="flex items-center justify-center gap-2 rounded-2xl border-2 py-[1.5vmin] text-[3vmin] font-semibold">
                <Rewind aria-hidden className="size-[3vmin]" /> 10s
              </button>
              <button type="button" onClick={() => back(30)} className="flex items-center justify-center gap-2 rounded-2xl border-2 py-[1.5vmin] text-[3vmin] font-semibold">
                <Rewind aria-hidden className="size-[3vmin]" /> 30s
              </button>
              <button type="button" onClick={toLive} className="flex items-center justify-center gap-2 rounded-2xl border-2 py-[1.5vmin] text-[3vmin] font-semibold">
                <Radio aria-hidden className="size-[3vmin]" /> Live
              </button>
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[2vmin]">
            {side("A", game.teamA, a, true)}
            {side("B", game.teamB, b, true)}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-[2vmin]">
          {side("A", game.teamA, a)}
          {side("B", game.teamB, b)}
        </div>
      )}
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
