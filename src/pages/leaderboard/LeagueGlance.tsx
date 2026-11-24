import { useMemo } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Card, CardContent } from "@/components/ui/card"
import { computeLeaderboard } from "@/lib/legacy-core"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

type Row = {
  player: { id: string }
  gp: number
  twoWayPer25: number
  rate: { pts: number; ast: number; oreb: number; dreb: number }
  totals: { pts: number }
  shooting: { fga: number; fta?: number }
}

// Games a player needs to be listed here, so one hot night does not lead the league.
const MIN_GP = 3
// Shots a player needs before their true shooting is listed.
const MIN_FGA = 15

// The top of the Leaderboard: the top three by Two-Way/G and who leads in scoring, passing, rebounding and shooting. Each name opens
// that player. The full ranking and every table are below and in the tabs.
export function LeagueGlance({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const { top, leaders, minGp } = useMemo(() => {
    const all = (computeLeaderboard() as Row[]).filter((r) => r.gp > 0)
    const minGp = all.filter((r) => r.gp >= MIN_GP).length >= 3 ? MIN_GP : 1
    const rows = all.filter((r) => r.gp >= minGp)
    const best = (value: (r: Row) => number | null) => {
      let out: { r: Row; v: number } | null = null
      for (const r of rows) {
        const v = value(r)
        if (v !== null && (!out || v > out.v)) out = { r, v }
      }
      return out
    }
    const ts = (r: Row) => {
      const tsa = r.shooting.fga + 0.44 * (r.shooting.fta ?? 0)
      return r.shooting.fga >= MIN_FGA && tsa > 0 ? (r.totals.pts / (2 * tsa)) * 100 : null
    }
    const leaders = [
      { label: "Points/G", hit: best((r) => r.rate.pts), fmt: (v: number) => v.toFixed(1) },
      { label: "Assists/G", hit: best((r) => r.rate.ast), fmt: (v: number) => v.toFixed(1) },
      { label: "Rebounds/G", hit: best((r) => r.rate.oreb + r.rate.dreb), fmt: (v: number) => v.toFixed(1) },
      { label: "True shooting", hit: best(ts), fmt: (v: number) => `${Math.round(v)}%` },
    ]
    return { top: [...rows].sort((a, b) => b.twoWayPer25 - a.twoWayPer25).slice(0, 3), leaders, minGp }
  }, [state])
  if (top.length === 0) return null
  const name = (id: string) => playerName(state, id)

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-muted-foreground">League at a glance</h2>
          {minGp > 1 && <span className="text-xs text-muted-foreground">Players with {minGp}+ games</span>}
        </div>
        <ol className="grid gap-2 sm:grid-cols-3" aria-label="Top three by Two-Way/G">
          {top.map((r, i) => (
            <li key={r.player.id}>
              <button type="button" onClick={() => onOpenPlayer(r.player.id)} className="flex w-full items-center gap-3 rounded-lg bg-muted/50 p-3 text-left transition-colors hover:bg-muted">
                <span className="font-display text-2xl font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                <PlayerAvatar id={r.player.id} name={name(r.player.id)} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{name(r.player.id)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{r.twoWayPer25.toFixed(1)} Two-Way/G</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {leaders.map((l) =>
            l.hit ? (
              <div key={l.label} className="flex flex-col rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{l.label}</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{l.fmt(l.hit.v)}</dd>
                <dd>
                  <button type="button" onClick={() => onOpenPlayer(l.hit!.r.player.id)} className="text-sm font-medium underline-offset-2 hover:underline">
                    {name(l.hit.r.player.id)}
                  </button>
                </dd>
              </div>
            ) : null,
          )}
        </dl>
      </CardContent>
    </Card>
  )
}
