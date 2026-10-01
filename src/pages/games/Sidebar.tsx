import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { formatDateDisplay } from "@/lib/format"
import { computeLeaderboard, teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

export function Sidebar({
  state,
  onOpenPlayer,
  onOpenGame,
}: {
  state: PooleanState
  onOpenPlayer: (id: string) => void
  onOpenGame: (g: Game) => void
}) {
  const rows = computeLeaderboard(state)
    .filter((r) => r.gp > 0)
    .sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
  const recent = [...state.games].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games with players yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>W-L</TableHead>
                  <TableHead>Two-Way/20</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.player.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="flex items-center gap-2 font-medium hover:underline"
                        onClick={() => onOpenPlayer(r.player.id)}
                      >
                        <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
                        {r.player.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      {r.wins}-{r.losses}
                      {r.ties ? `-${r.ties}` : ""}
                    </TableCell>
                    <TableCell className="tabular-nums">{r.twoWayPer20.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Games</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No games logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {recent.map((g) => {
                const reviewed = g.scoringEvents.length > 0
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted"
                      onClick={() => onOpenGame(g)}
                    >
                      <span>{formatDateDisplay(g.date)}</span>
                      <span className={reviewed ? "font-semibold tabular-nums" : "text-muted-foreground"}>
                        {reviewed ? `${teamScore(g, g.teamA)}–${teamScore(g, g.teamB)}` : "Not reviewed"}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
