import { EmptyState } from "@/components/EmptyState"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InjuryBoard } from "@/components/InjuryBoard"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import type { Update } from "@/lib/store"
import { HeadToHeadCard } from "./HeadToHeadCard"
import { AwardRaceCard } from "./AwardRace"
import { PredictionScorecard } from "./PredictionScorecard"
import { RecordsCard, SeasonStoriesCard } from "./SeasonCards"
import { formatDateDisplay } from "@/lib/format"
import { computeLeaderboard, teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

export function Sidebar({
  state,
  onOpenPlayer,
  onOpenGame,
  update,
}: {
  update: Update
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
      <InjuryBoard state={state} update={update} onOpenPlayer={onOpenPlayer} />
      <SeasonStoriesCard state={state} update={update} />
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 && <p className="mb-2 text-xs text-muted-foreground">W-L here counts only games with a box score and even teams. The season stories count every finished game, so their records can be higher.</p>}
          {rows.length === 0 ? (
            <EmptyState title="No standings yet" hint="Standings fill in once a game is logged with players." />
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
                {rows.map((r) => (
                  <TableRow key={r.player.id}>
                    <TableCell>{rows.filter((x) => x.twoWayPer20 > r.twoWayPer20).length + 1}{rows.filter((x) => x.twoWayPer20 === r.twoWayPer20).length > 1 ? " (tie)" : ""}</TableCell>
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
                      <div className="flex flex-col gap-1">
                        <span>
                          {r.wins}-{r.losses}
                          {r.ties ? `-${r.ties}` : ""}
                        </span>
                        {r.wins + r.losses + (r.ties ?? 0) > 0 && (
                          <div role="img" aria-label={`${r.wins} wins, ${r.losses} losses`} className="flex h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <span className="anim-bar bg-pos" style={{ width: `${(r.wins / (r.wins + r.losses + (r.ties ?? 0))) * 100}%` }} />
                            <span className="anim-bar bg-muted-foreground/40" style={{ width: `${((r.ties ?? 0) / (r.wins + r.losses + (r.ties ?? 0))) * 100}%` }} />
                            <span className="anim-bar bg-neg" style={{ width: `${(r.losses / (r.wins + r.losses + (r.ties ?? 0))) * 100}%` }} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{r.twoWayPer20.toFixed(1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <PredictionScorecard state={state} onOpenGame={onOpenGame} />
      <HeadToHeadCard state={state} onOpenGame={onOpenGame} />
      <AwardRaceCard state={state} onOpenPlayer={onOpenPlayer} />
      <RecordsCard state={state} onOpenPlayer={onOpenPlayer} />
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Recent Games</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <EmptyState title="No games logged yet" hint="Create a game on this page and your most recent ones show here." />
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
