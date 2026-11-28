import { ViewTabs } from "@/components/PanelGroup"
import { Explain } from "@/components/Explain"
import { EmptyState } from "@/components/EmptyState"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InjuryBoard } from "@/components/InjuryBoard"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import type { Update } from "@/lib/store"
import { HeadToHeadCard } from "./HeadToHeadCard"
import { AwardRaceCard } from "./AwardRace"
import { ProjectionsCard } from "./Projections"
import { AttendanceCard, RivalriesCard } from "./RivalryCards"
import { SeasonPredictionsCard } from "./Predictions"
import { PredictionScorecard } from "./PredictionScorecard"
import { RecordsCard, SeasonStoriesCard } from "./SeasonCards"
import { distinctNumbers } from "@/lib/format"
import { showHub } from "@/lib/offseason"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import { seasonView } from "@/lib/season"
import { computeLeaderboard } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

export function Sidebar({
  state,
  pastSeasons = false,
  onOpenPlayer,
  onOpenGame,
  update,
}: {
  update: Update
  state: PooleanState
  pastSeasons?: boolean
  onOpenPlayer: (id: string) => void
  onOpenGame: (g: Game) => void
}) {
  // The standings follow the Include past seasons filter (this season, plus a few recent games while it is young).
  const board = computeLeaderboard(seasonView(state, pastSeasons))
  const rows = board.filter((r) => r.gp >= MIN_RANKED).sort((a, b) => b.twoWayPer25 - a.twoWayPer25)
  const twoWayText = distinctNumbers(rows.map((r) => r.twoWayPer25))
  // Everyone else is still listed, just not ranked until they have played enough games for a rank to mean something.
  const unranked = board.filter((r) => r.gp < MIN_RANKED)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length > 0 && (
            <>
              <details className="mb-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">Ranked by two-way per game. What do these numbers mean?</summary>
                <dl className="mt-2 flex flex-col gap-1.5">
                  <div>
                    <dt className="inline font-semibold text-foreground">Which games count: </dt>
                    <dd className="inline">only games with a box score and even teams, so W-L here can be lower than in the season stories, which count every finished game. When two players show the same number, the exact value decides.</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Two-way score: </dt>
                    <dd className="inline">a player's offense and defense in one game, added together.</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Defensive score: </dt>
                    <dd className="inline">steals, blocks and stops, minus times beaten and points allowed.</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-foreground">Per game: </dt>
                    <dd className="inline">scaled to an average game's worth of possessions, so a short game and a long one compare fairly.</dd>
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
            <EmptyState title="No standings yet" hint={`Standings fill in once someone has ${MIN_RANKED} filmed games with even teams.`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>W-L</TableHead>
                  <TableHead>Two-Way/G <Explain term="Two-Way/G" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.player.id}>
                    <TableCell>{rows.filter((x) => x.twoWayPer25 > r.twoWayPer25).length + 1}{rows.filter((x) => x.twoWayPer25 === r.twoWayPer25).length > 1 ? " (tie)" : ""}</TableCell>
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
          {unranked.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                {unranked.length} more {unranked.length === 1 ? "player" : "players"}, not ranked yet
              </summary>
              <p className="mt-1 text-xs text-muted-foreground">They need {MIN_RANKED} games with a box score and even teams to be ranked. Their pages and stats are all still there.</p>
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
      <SeasonStoriesCard state={state} update={update} />
      <AwardRaceCard state={state} onOpenPlayer={onOpenPlayer} />
      <ProjectionsCard state={state} onOpenPlayer={onOpenPlayer} />
      {state.openingNight && !showHub(state) && <SeasonPredictionsCard state={state} />}
      <InjuryBoard state={state} update={update} onOpenPlayer={onOpenPlayer} />
      {/* The smaller cards share one spot with a tab each, so the column is a few cards long, not ten. */}
      <ViewTabs
        tabs={[
          { value: "rivals", label: "Rivalries", node: <RivalriesCard state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "h2h", label: "Head to head", node: <HeadToHeadCard state={state} onOpenGame={onOpenGame} /> },
          { value: "records", label: "Records", node: <RecordsCard state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "picks", label: "Predictions", node: <PredictionScorecard state={state} onOpenGame={onOpenGame} /> },
          { value: "attend", label: "Attendance", node: <AttendanceCard state={state} onOpenPlayer={onOpenPlayer} /> },
        ]}
      />
    </div>
  )
}
