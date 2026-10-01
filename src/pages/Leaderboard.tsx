import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { computeLeaderboard, type LeaderboardRow } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

function formatPct(v: number | null) {
  return v === null ? "—" : `${v}%`
}

function fmtRate(v: number) {
  return v.toFixed(1)
}

const SORT_KEY = "twoWayPer20" as const

function sortRows(rows: LeaderboardRow[]) {
  return [...rows].sort((a, b) => b[SORT_KEY] - a[SORT_KEY])
}

function DesktopTable({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>GP</TableHead>
            <TableHead>W-L</TableHead>
            <TableHead>PCT</TableHead>
            <TableHead>PTS/20</TableHead>
            <TableHead>FG</TableHead>
            <TableHead>TS%</TableHead>
            <TableHead>AST/20</TableHead>
            <TableHead>TOV%</TableHead>
            <TableHead>A/TO</TableHead>
            <TableHead>Off Rating/20</TableHead>
            <TableHead className="font-semibold text-foreground">Two-Way/20</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.player.id}>
              <TableCell>
                <span className="flex items-center gap-2 font-medium">
                  <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
                  {r.player.name}
                </span>
              </TableCell>
              <TableCell>{r.gp}</TableCell>
              <TableCell>
                {r.wins}-{r.losses}
                {r.ties ? `-${r.ties}` : ""}
              </TableCell>
              <TableCell>{formatPct(r.winPct)}</TableCell>
              <TableCell className="font-display font-bold tabular-nums">{fmtRate(r.ptsPer20)}</TableCell>
              <TableCell>
                {r.shooting.fgm}/{r.shooting.fga}
              </TableCell>
              <TableCell>{formatPct(r.tsPct)}</TableCell>
              <TableCell>{fmtRate(r.astPer20)}</TableCell>
              <TableCell>{formatPct(r.tovPct)}</TableCell>
              <TableCell>{r.astTov}</TableCell>
              <TableCell>{fmtRate(r.offRatingPer20)}</TableCell>
              <TableCell className="font-display font-bold tabular-nums">{fmtRate(r.twoWayPer20)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  )
}

// Mobile card view: one card per row, reflowing the same data the desktop table shows (not a
// trimmed subset) -- the headline stat (Two-Way/20, this table's own sort key) gets the hero
// treatment, every other column stays a plain label:value line. See the mobile-card-view plan
// this migration folded in.
function MobileCards({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {rows.map((r, i) => (
        <Card key={r.player.id}>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium">
                <PlayerAvatar id={r.player.id} name={r.player.name} />
                {r.player.name}
              </span>
              <span className="text-sm text-muted-foreground">#{i + 1}</span>
            </div>
            <div className="flex items-baseline justify-between rounded-md bg-accent/10 px-3 py-2">
              <span className="text-xs text-muted-foreground">Two-Way/20</span>
              <span className="font-display text-2xl font-bold tabular-nums text-accent">
                {fmtRate(r.twoWayPer20)}
              </span>
            </div>
            <StatLine label="Record" value={`${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ""} (${formatPct(r.winPct)})`} />
            <StatLine label="PTS/20" value={fmtRate(r.ptsPer20)} />
            <StatLine label="FG" value={`${r.shooting.fgm}/${r.shooting.fga} (${formatPct(r.tsPct)} TS)`} />
            <StatLine label="AST/20" value={fmtRate(r.astPer20)} />
            <StatLine label="TOV% / A-TO" value={`${formatPct(r.tovPct)} / ${r.astTov}`} />
            <StatLine label="Off Rating/20" value={fmtRate(r.offRatingPer20)} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function LeaderboardPage({ state }: { state: PooleanState }) {
  const rows = sortRows(computeLeaderboard(state).filter((r) => r.gp > 0))

  if (rows.length === 0) {
    return <p className="text-muted-foreground">No players yet.</p>
  }

  return (
    <div>
      <DesktopTable rows={rows} />
      <MobileCards rows={rows} />
    </div>
  )
}
