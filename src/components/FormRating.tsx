import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { currentForm, FORM_MEASURE_AT, PRIOR_GAMES, type FormRow } from "@/lib/form"
import { playerName } from "@/lib/players"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"
import { signed } from "@/lib/format"

// The form rating (form.ts), a DARKO-style estimate of how many points a player adds a game right now, with its likely range.

function HowItWorks({ measured, games }: { measured: boolean; games: number }) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer">How it is worked out</summary>
      <p className="mt-1">
        Like DARKO in the NBA: each part of Points added (shots, passes, turnovers, offensive rebounds, defense) is followed game by game.
        Everyone starts at the league average, and each game moves a player only as far as one game can be trusted, which depends on how much
        that part swings from night to night. The parts add up to the rating, and the range is where the rating likely sits (about 4 in 5).{" "}
        {measured
          ? "How far a game moves each part is measured from the league's own games, so steadier parts are trusted faster."
          : `With ${games} filmed ${games === 1 ? "game" : "games"}, the league cannot yet measure how quickly each part can be trusted, so every part counts a player's talent as known as well as ${PRIOR_GAMES} games would show it; from ${FORM_MEASURE_AT} filmed games it measures each part's own.`}{" "}
        Checked against players' next nights, each predicted only from earlier nights: closer than their average leaned on the league.
      </p>
    </details>
  )
}

export function FormRatingCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const f = useMemo(() => currentForm(state), [state])
  if (f.rows.length < 3) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form rating</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Hint
          text={
            <>
              How many points each player adds a game right now, by Points added, pulled toward the league average until enough games say
              otherwise. A few big nights move it a little, not a lot. The range is how sure it is: it narrows as games come in.
            </>
          }
        />
        <HowItWorks measured={f.measured} games={f.games} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Form</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Likely range</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Games</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {f.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.id)}>
                    {playerName(state, r.id)}
                  </button>
                  <span className="block text-xs text-muted-foreground sm:hidden">
                    {signed(r.low)} to {signed(r.high)}, {r.games} {r.games === 1 ? "game" : "games"}
                  </span>
                </TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", r.mean > 0.05 && "text-pos")}>{signed(r.mean)}</TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">
                  {signed(r.low)} to {signed(r.high)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{signed(average(r))}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.games}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

const average = (r: FormRow) => r.history.reduce((a, h) => a + h.actual, 0) / Math.max(1, r.history.length)

// One player's rating after each game, with its range as a band and each game's own Points added as a dot.
export function PlayerFormCard({ state, pid }: { state: PooleanState; pid: string }) {
  const f = useMemo(() => currentForm(state), [state])
  const r = f.rows.find((x) => x.id === pid)
  if (!r) return null
  const h = r.history
  const W = 320
  const H = 140
  const pad = 8
  const lo = Math.min(-2, ...h.map((p) => p.mean - 1.28 * p.sd), ...h.map((p) => p.actual))
  const hi = Math.max(2, ...h.map((p) => p.mean + 1.28 * p.sd), ...h.map((p) => p.actual))
  const x = (i: number) => (h.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (h.length - 1))
  const y = (v: number) => pad + ((hi - v) * (H - 2 * pad)) / (hi - lo)
  const band = [...h.map((p, i) => `${x(i)},${y(p.mean + 1.28 * p.sd)}`), ...[...h].reverse().map((p, j) => `${x(h.length - 1 - j)},${y(p.mean - 1.28 * p.sd)}`)].join(" ")
  const line = h.map((p, i) => `${x(i)},${y(p.mean)}`).join(" ")
  const name = playerName(state, pid)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Form rating</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-display text-2xl font-bold tabular-nums">{signed(r.mean)}</span> points added a game right now, likely between{" "}
          {signed(r.low)} and {signed(r.high)}. Their plain average is {signed(average(r))} over {r.games} {r.games === 1 ? "game" : "games"}; the rating leans that toward the
          league average until more games say otherwise.
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name}'s form rating after each game`} className="h-36 w-full">
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeDasharray="3 3" />
          <polygon points={band} className="fill-primary/15" />
          <polyline points={line} fill="none" className="stroke-primary" strokeWidth={2} />
          {h.map((p, i) => (
            <circle key={p.gameId} cx={x(i)} cy={y(p.actual)} r={3} className="fill-muted-foreground" />
          ))}
        </svg>
        <p className="text-xs text-muted-foreground">The line is the rating after each game, the shaded band its likely range, the dots each game's own Points added. The dashed line is the league average.</p>
        <HowItWorks measured={f.measured} games={f.games} />
      </CardContent>
    </Card>
  )
}
