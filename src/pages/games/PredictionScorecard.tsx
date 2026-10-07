import { Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { confidenceOf, scorecard } from "@/lib/scorecard"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

// The model's pregame calls against what happened. Each call is saved when the game is set up, so this is a plain
// record of how often the favorite actually won.
export function PredictionScorecard({ state, onOpenGame }: { state: PooleanState; onOpenGame: (g: Game) => void }) {
  const sc = scorecard(state)
  if (sc.called === 0 && sc.waiting === 0) return null
  const recent = [...sc.calls].reverse().slice(0, 5)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Target aria-hidden className="size-4 text-accent" /> Prediction scorecard
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sc.called > 0 ? (
          <p>
            <span className="font-display text-3xl font-bold tabular-nums">
              {sc.correct} of {sc.called}
            </span>{" "}
            <span className="text-sm text-muted-foreground">
              favorites won ({sc.pct}%). The pick is saved before each game and scored after.
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No scored calls yet. The first one lands when a game with a saved pick finishes.</p>
        )}
        {sc.waiting > 0 && (
          <p className="text-xs text-muted-foreground">
            {sc.waiting} saved {sc.waiting === 1 ? "pick is" : "picks are"} waiting on a result.
          </p>
        )}
        {sc.buckets.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-sm">
            {sc.buckets.map((b) => (
              <li key={b.label} className="flex justify-between">
                <span className="text-muted-foreground">Model gave the favorite {b.label}</span>
                <span className="tabular-nums">
                  {b.correct} of {b.called}
                </span>
              </li>
            ))}
          </ul>
        )}
        {recent.length > 0 && (
          <ul className="flex flex-col gap-1" aria-label="Recent calls">
            {recent.map((c) => (
              <li key={c.game.id}>
                <button type="button" className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => onOpenGame(c.game)}>
                  <span>{formatDateDisplay(c.game.date)}</span>
                  <span className="text-muted-foreground">
                    Picked {c.favorite} ({Math.round(confidenceOf(c.game) * 100)}%), {c.winner} won
                  </span>
                  <span className={cn("font-semibold", c.correct ? "text-pos" : "text-neg")}>{c.correct ? "Right" : "Wrong"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
