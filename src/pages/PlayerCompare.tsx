import { ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { headToHead } from "@/lib/headToHead"
import { playerName } from "@/lib/players"
import { perTrip, possessions } from "@/lib/possessions"
import { ATTRS, ATTR_LABEL, ratings } from "@/lib/ratings"
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

interface Line {
  label: string
  a: number | null
  b: number | null
  text: (v: number) => string
  low?: boolean // lower is better
}

const one = (v: number) => v.toFixed(1)
const whole = (v: number) => String(Math.round(v))
const pc = (v: number) => `${Math.round(v)}%`

// Two players side by side: the same numbers the leaderboard shows, with the better one in bold, and their record against and
// alongside each other. `state` is the season view, so it matches the rest of the player page.
export function PlayerCompare({ state, pid }: { state: PooleanState; pid: string }) {
  const [other, setOther] = useState("")
  const d = useMemo(() => {
    if (!other) return null
    const board = computeLeaderboard(state)
    const rated = ratings(state)
    const trips = possessions(state).rows
    const of = (id: string) => ({ row: board.find((r) => r.player.id === id), rating: rated.find((r) => r.id === id), trip: trips.find((r) => r.id === id) })
    const [a, b] = [of(pid), of(other)]
    const pick = <T,>(x: T | undefined, get: (v: T) => number | null) => (x ? get(x) : null)
    const row = (label: string, get: (r: NonNullable<typeof a.row>) => number | null, text = one, low = false): Line => ({ label, a: a.row?.gp ? pick(a.row, get) : null, b: b.row?.gp ? pick(b.row, get) : null, text, low })
    const lines: Line[] = [
      row("Filmed games", (r) => r.gp, whole),
      row("Win %", (r) => r.winPct, pc),
      row("Two-way per game", (r) => r.twoWayPer25),
      row("Offense per game", (r) => r.offRatingPer25),
      row("Points per game", (r) => r.ptsPer25),
      row("Assists per game", (r) => r.astPer25),
      row("True shooting", (r) => r.tsPct, pc),
      row("Live-ball turnovers per game", (r) => r.liveTovPer25, one, true),
      { label: "Own points per trip", a: pick(a.trip, (t) => perTrip(t.pts, t.used)), b: pick(b.trip, (t) => perTrip(t.pts, t.used)), text: (v) => v.toFixed(2) },
      { label: "Overall rating", a: a.rating?.ovr ?? null, b: b.rating?.ovr ?? null, text: whole },
      ...ATTRS.map((k) => ({ label: ATTR_LABEL[k], a: a.rating?.attrs[k] ?? null, b: b.rating?.attrs[k] ?? null, text: whole })),
    ]
    return { lines: lines.filter((l) => l.a !== null || l.b !== null), h: headToHead(state, pid, other) }
  }, [state, pid, other])
  const others = state.players.filter((p) => p.id !== pid)
  if (others.length === 0) return null
  const cell = (l: Line, v: number | null, vs: number | null) => {
    const better = v !== null && vs !== null && v !== vs && (l.low ? v < vs : v > vs)
    return <td className={`px-2 py-1.5 text-right tabular-nums ${better ? "font-bold text-foreground" : "text-muted-foreground"}`}>{v === null ? "-" : l.text(v)}</td>
  }
  return (
    <details className="group rounded-xl border bg-card" data-player-panel="Compare">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 font-display font-bold [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        Compare with another player
      </summary>
      <div className="flex flex-col gap-3 p-4 pt-0">
        <label className="flex flex-wrap items-center gap-2 text-sm">
          {playerName(state, pid)} against
          <select className="rounded-md border bg-background px-2 py-1.5" value={other} onChange={(e) => setOther(e.target.value)}>
            <option value="">Pick a player</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        {d && (
          <>
            <p className="text-sm">
              {d.h.meetings.length === 0
                ? "They have not faced each other."
                : `Facing each other: ${playerName(state, pid)} ${d.h.aWins}, ${playerName(state, other)} ${d.h.bWins}, scoring ${d.h.aPts.toFixed(1)} and ${d.h.bPts.toFixed(1)} a game.`}{" "}
              {d.h.togetherWins + d.h.togetherLosses > 0 ? `On the same team they are ${d.h.togetherWins}-${d.h.togetherLosses}.` : "They have not shared a team."}
            </p>
            {d.lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Neither has a filmed game with even teams yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="py-1 pr-2 text-left font-medium">Stat</th>
                      <th className="px-2 py-1 text-right font-medium">{playerName(state, pid)}</th>
                      <th className="px-2 py-1 text-right font-medium">{playerName(state, other)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => (
                      <tr key={l.label} className="border-t">
                        <td className="py-1.5 pr-2">{l.label}</td>
                        {cell(l, l.a, l.b)}
                        {cell(l, l.b, l.a)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">The better number is in bold. Ratings need 5 filmed games. A gap over a handful of games is a first read, not a verdict.</p>
          </>
        )}
      </div>
    </details>
  )
}
