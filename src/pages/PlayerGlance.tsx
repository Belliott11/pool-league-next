import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { computeLeaderboard } from "@/lib/legacy-core"
import { metricsFor, scoutCard, type BoardRow } from "@/lib/scouting"
import type { PooleanState } from "@/lib/types"

type Row = BoardRow & { wins: number; losses: number; ties: number; winPct: number | null; twoWayPer25: number; totals: { pts: number }; shooting: { fga: number; fta?: number } }

// Games a player needs before a standings rank means anything.
const RANKED_GP = 3

// The few numbers someone opening a player's page wants first: where they stand, how often they win, what they grab and how well they shoot, and one
// line each on what they do best and what to work on (from the scouting report). Everything else is in the tabs below.
export function PlayerGlance({ state, pid }: { state: PooleanState; pid: string }) {
  const { row, rank, ranked, card } = useMemo(() => {
    const board = computeLeaderboard() as Row[]
    const row = board.find((r) => r.player.id === pid) ?? null
    const order = board.filter((r) => r.gp >= RANKED_GP).sort((a, b) => b.twoWayPer25 - a.twoWayPer25)
    const at = order.findIndex((r) => r.player.id === pid)
    return { row, rank: at >= 0 ? at + 1 : null, ranked: order.length, card: scoutCard(metricsFor(state, board), pid) }
  }, [state, pid])
  if (!row || row.gp === 0) return null

  const tsa = row.shooting.fga + 0.44 * (row.shooting.fta ?? 0)
  const ts = tsa > 0 ? Math.round((row.totals.pts / (2 * tsa)) * 100) : null
  const tiles: { label: string; value: string; sub: string }[] = [
    { label: "Standing", value: rank ? `#${rank}` : "Unranked", sub: rank ? `of ${ranked} by Two-Way/G` : `needs ${RANKED_GP} games` },
    { label: "Win rate", value: row.winPct === null ? "None yet" : `${Math.round(row.winPct)}%`, sub: `${row.gp} game${row.gp === 1 ? "" : "s"}` },
    { label: "Rebounds/G", value: (row.rate.oreb + row.rate.dreb).toFixed(1), sub: `${row.rate.oreb.toFixed(1)} on offense` },
    { label: "True shooting", value: ts === null ? "No shots" : `${ts}%`, sub: "3s and free throws count" },
  ]
  const best = card?.strengths[0]
  const work = card?.workOn[0]

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="font-display text-sm font-semibold text-muted-foreground">At a glance</h2>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="font-display text-2xl font-bold tabular-nums">{t.value}</dd>
              <dd className="text-xs text-muted-foreground">{t.sub}</dd>
            </div>
          ))}
        </dl>
        {(best || work) && (
          <ul className="flex flex-col gap-1 text-sm">
            {best && (
              <li>
                <span className="font-semibold">Best at:</span> {best.label} ({best.text}; {best.vs})
              </li>
            )}
            {work && (
              <li>
                <span className="font-semibold">Work on:</span> {work.label} ({work.text}; {work.vs})
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
