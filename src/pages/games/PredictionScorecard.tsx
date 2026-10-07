import { Target } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { confidenceOf, scorecard, type Call } from "@/lib/scorecard"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

type Summary = { calls: Call[]; called: number; correct: number; pct: number | null; buckets: { label: string; called: number; correct: number }[] }

function Record({ title, note, s, onOpenGame }: { title: string; note: string; s: Summary; onOpenGame: (g: Game) => void }) {
  const recent = [...s.calls].sort((a, b) => (b.game.date || "").localeCompare(a.game.date || "")).slice(0, 5)
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <h4 className="text-sm font-semibold">{title}</h4>
      <p>
        <span className="font-display text-3xl font-bold tabular-nums">
          {s.correct} of {s.called}
        </span>{" "}
        <span className="text-sm text-muted-foreground">favorites won ({s.pct}%). {note}</span>
      </p>
      {s.buckets.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-sm">
          {s.buckets.map((b) => (
            <li key={b.label} className="flex justify-between">
              <span className="text-muted-foreground">Model gave the favorite {b.label}</span>
              <span className="tabular-nums">
                {b.correct} of {b.called}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="flex flex-col gap-1" aria-label={`Recent ${title}`}>
        {recent.map((c) => (
          <li key={c.game.id}>
            <button type="button" className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted" onClick={() => onOpenGame(c.game)}>
              <span>{formatDateDisplay(c.game.date)}</span>
              <span className="text-muted-foreground">
                Picked {c.favorite} ({Math.round((c.game.prediction ? confidenceOf(c.game) : c.confidence) * 100)}%), {c.winner} won
              </span>
              <span className={cn("font-semibold", c.correct ? "text-pos" : "text-neg")}>{c.correct ? "Right" : "Wrong"}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// The model's calls against what happened. Picks saved before a game are the live record; past games with no saved pick
// get a backtest, each called by a model that had only the games before it, shown separately and labeled.
export function PredictionScorecard({ state, onOpenGame }: { state: PooleanState; onOpenGame: (g: Game) => void }) {
  const sc = scorecard(state)
  if (sc.called === 0 && sc.waiting === 0 && sc.backtest.called === 0 && sc.imported.called === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Target aria-hidden className="size-4 text-accent" /> Prediction scorecard
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {(sc.called > 0 || sc.waiting > 0) && (
          <div className="flex flex-col gap-2">
            {sc.called > 0 ? (
              <Record title="Saved before the game" note="The pick was saved before each game and scored after." s={sc} onOpenGame={onOpenGame} />
            ) : (
              <p className="text-sm text-muted-foreground">No scored saved picks yet. The first lands when a game with a saved pick finishes.</p>
            )}
            {sc.waiting > 0 && (
              <p className="text-xs text-muted-foreground">
                {sc.waiting} saved {sc.waiting === 1 ? "pick is" : "picks are"} waiting on a result.
              </p>
            )}
          </div>
        )}
        {sc.backtest.called > 0 && (
          <Record title="Backtest on past games" note="Each was called afterward by a model that had only the games before it, so these were not saved in advance." s={sc.backtest} onOpenGame={onOpenGame} />
        )}
        {sc.imported.called > 0 && (
          <p className="text-sm text-muted-foreground">
            Imported history, called night by night from only the games before each: {sc.imported.correct} of {sc.imported.called} ({Math.round((sc.imported.correct / sc.imported.called) * 100)}%).
          </p>
        )}
        <p className="text-xs text-muted-foreground">The backtest is not perfectly hindsight-free: the model&apos;s inputs and its shrink factor were chosen by looking at past results.</p>
      </CardContent>
    </Card>
  )
}
