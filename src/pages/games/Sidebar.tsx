import { EmptyState } from "@/components/EmptyState"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InjuryBoard } from "@/components/InjuryBoard"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import type { Update } from "@/lib/store"
import { HeadToHeadCard } from "./HeadToHeadCard"
import { AwardRaceCard } from "./AwardRace"
import { AttendanceCard, RivalriesCard } from "./RivalryCards"
import { SeasonPredictionsCard } from "./Predictions"
import { PredictionScorecard } from "./PredictionScorecard"
import { RecordsCard, SeasonStoriesCard } from "./SeasonCards"
import { distinctNumbers, formatDateDisplay } from "@/lib/format"
import { isOffseason } from "@/lib/offseason"
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
  const board = computeLeaderboard(state)
  const rows = board.filter((r) => r.gp > 0).sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
  const twoWayText = distinctNumbers(rows.map((r) => r.twoWayPer20))
  // Everyone else is still listed, just not ranked until they have a box-scored game.
  const unranked = board.filter((r) => r.gp === 0)
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
          {rows.length > 0 && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                Ranked by two-way per 20: offense plus defense per 20 points played. Only games with a box score and even teams count, so W-L here can be lower than in the season stories, which count every finished game. When two players show the same number, the exact value decides.
              </p>
              <details className="mb-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">What do these numbers mean?</summary>
                <dl className="mt-2 flex flex-col gap-1.5">
                  <div>
                    <dt className="inline font-semibold text-foreground">Two-way score: </dt>
                    <dd className="inline">a player's offense and defense in one game, added together.</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Defensive score: </dt>
                    <dd className="inline">steals, blocks and stops, minus times beaten and points allowed.</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Per 20: </dt>
                    <dd className="inline">scaled to 20 points of play, so a short game and a long one compare fairly.</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Uneven teams: </dt>
                    <dd className="inline">games like 3 against 2 are left out of the Leaderboard unless you turn on Include Imbalanced Games.</dd>
                  </div>
                </dl>
              </details>
            </>
          )}
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
                {rows.map((r, i) => (
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
                    <TableCell className="tabular-nums">{twoWayText[i]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {rows.length > 0 && unranked.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                {unranked.length} more {unranked.length === 1 ? "player" : "players"}, not ranked yet
              </summary>
              <p className="mt-1 text-xs text-muted-foreground">They need a game with a box score and even teams to be ranked.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {unranked.map((r) => (
                  <button key={r.player.id} type="button" className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 hover:bg-muted" onClick={() => onOpenPlayer(r.player.id)}>
                    <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
                    {r.player.name}
                  </button>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
      <PredictionScorecard state={state} onOpenGame={onOpenGame} />
      <HeadToHeadCard state={state} onOpenGame={onOpenGame} />
      <AwardRaceCard state={state} onOpenPlayer={onOpenPlayer} />
      {state.openingNight && !isOffseason(state) && <SeasonPredictionsCard state={state} />}
      <RivalriesCard state={state} onOpenPlayer={onOpenPlayer} />
      <AttendanceCard state={state} onOpenPlayer={onOpenPlayer} />
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
