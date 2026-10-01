import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import {
  bestEvenSwap,
  computeRealMatchupTrackRecord,
  getRealMatchupModel,
  predictRealMatchup,
  REAL_MATCHUP_MIN_GAMES,
  realMatchupAccuracyText,
} from "@/lib/matchup"
import { poolNameOf, realSeasonsInOrder } from "@/lib/real"
import type { PooleanState } from "@/lib/types"

type Side = "A" | "B"

// Every player the predictor can use: the local roster plus every real-site player, by name.
function playerPool(state: PooleanState) {
  const ids = new Set(state.players.map((p) => p.id))
  realSeasonsInOrder().forEach((s) => Object.keys(s.names || {}).forEach((id) => ids.add(id)))
  return [...ids].map((id) => ({ id, name: poolNameOf(state, id) })).sort((a, b) => a.name.localeCompare(b.name))
}

function TrackRecord() {
  const t = computeRealMatchupTrackRecord()
  if (t.nights.length === 0 || t.total.called === 0) return null
  const p = (x: { correct: number; called: number }) => (x.called ? Math.round((x.correct / x.called) * 100) : 0)
  const trend =
    t.nights.length >= 4 && t.early.called && t.late.called
      ? ` First half of those nights: ${p(t.early)}%. Second half: ${p(t.late)}%.`
      : ""
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer">
        Track record: {t.total.correct} of {t.total.called} ({p(t.total)}%) called right before they were played
      </summary>
      <p className="my-2 text-muted-foreground">
        Before each party night, the model is retrained on only the games before it, then asked to call that night&apos;s games.{trend}
      </p>
      <ul className="flex flex-col gap-1">
        {[...t.nights].reverse().map((n, i) => (
          <li key={n.date}>
            {formatDateDisplay(n.date)} {i === 0 && <Badge variant="secondary">Latest</Badge>}{" "}
            <span className="text-muted-foreground">
              called {n.correct} of {n.called}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

export function MatchupPredictor({ state }: { state: PooleanState }) {
  const [sides, setSides] = useState<Record<string, Side>>({})
  const model = getRealMatchupModel()

  const cycle = (id: string) =>
    setSides((cur) => {
      const next = { ...cur }
      if (!cur[id]) next[id] = "A"
      else if (cur[id] === "A") next[id] = "B"
      else delete next[id]
      return next
    })

  const teamA = Object.keys(sides).filter((id) => sides[id] === "A")
  const teamB = Object.keys(sides).filter((id) => sides[id] === "B")
  const pred = model ? predictRealMatchup(teamA, teamB) : null
  const swap = pred ? bestEvenSwap(teamA, teamB) : null
  const names = (ids: string[]) => ids.map((id) => poolNameOf(state, id)).join(", ")
  const pA = pred ? Math.round(pred.pA * 100) : 0
  const leaning = pred ? pred.factors.filter((f) => Math.abs(f.lean) >= 1) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">
          Matchup Predictor <Badge variant="secondary">Real site data</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Win odds for any two teams from a small model trained on every real game in every imported season. Tap a name once for Team A,
          again for Team B, again to clear.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!model ? (
          <p className="text-muted-foreground">Needs at least {REAL_MATCHUP_MIN_GAMES} real games imported before it can predict anything.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {playerPool(state).map((p) => (
                <Button key={p.id} type="button" size="sm" variant={sides[p.id] ? "default" : "outline"} onClick={() => cycle(p.id)}>
                  {sides[p.id] ? `${sides[p.id]} · ` : ""}
                  {p.name}
                </Button>
              ))}
            </div>
            <TrackRecord />
            {!pred ? (
              <p className="text-sm text-muted-foreground">Put at least one player on each team. {realMatchupAccuracyText(model)}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between gap-4">
                  <div>
                    <div className="font-display text-4xl font-bold tabular-nums">{pA}%</div>
                    <div className="text-sm">Team A</div>
                    <div className="text-sm text-muted-foreground">{names(teamA)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-4xl font-bold tabular-nums">{100 - pA}%</div>
                    <div className="text-sm">Team B</div>
                    <div className="text-sm text-muted-foreground">{names(teamB)}</div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Team A ${pA} percent, Team B ${100 - pA} percent`}>
                  <div className="h-full bg-accent" style={{ width: `${pA}%` }} />
                </div>
                {leaning.length > 0 ? (
                  <ul className="text-sm text-muted-foreground">
                    {leaning.map((f) => (
                      <li key={f.label}>
                        {f.label}: leans {f.lean > 0 ? "Team A" : "Team B"} +{Math.round(Math.abs(f.lean))}%
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing separates these two teams: a coin flip.</p>
                )}
                {pred.unranked.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    No power ranking yet for {pred.unranked.map((id) => poolNameOf(state, id)).join(", ")}, counted as well below average
                    until they&apos;ve actually played.
                  </p>
                )}
                {swap && (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    Most even trade: {poolNameOf(state, swap.a)} for {poolNameOf(state, swap.b)} makes it {Math.round(swap.pA * 100)}% /{" "}
                    {100 - Math.round(swap.pA * 100)}%.
                    <Button size="sm" variant="outline" onClick={() => setSides((cur) => ({ ...cur, [swap.a]: "B", [swap.b]: "A" }))}>
                      Make the Trade
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {realMatchupAccuracyText(model)} Trained on {model.n} real games.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
