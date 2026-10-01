import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import {
  gameDefenseStats,
  getGameStats,
  shootingStats,
  teamScore,
  twoWayScore,
} from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

function TeamBoxScore({ state, game, ids, label }: { state: PooleanState; game: Game; ids: string[]; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display font-semibold">
        {label} <span className="text-muted-foreground tabular-nums">{teamScore(game, ids)}</span>
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Player</TableHead>
            <TableHead>PTS</TableHead>
            <TableHead>OREB</TableHead>
            <TableHead>DREB</TableHead>
            <TableHead>AST</TableHead>
            <TableHead>STL</TableHead>
            <TableHead>BLK</TableHead>
            <TableHead>TOV</TableHead>
            <TableHead>PF</TableHead>
            <TableHead>FG</TableHead>
            <TableHead>3PT</TableHead>
            <TableHead>FT</TableHead>
            <TableHead>Two-Way</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ids.map((id) => {
            const s = getGameStats(game, id)
            const sh = shootingStats(game, id)
            const tw = twoWayScore(s, sh, gameDefenseStats(game, id))
            const name = playerName(state, id)
            return (
              <TableRow key={id}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <PlayerAvatar id={id} name={name} size="sm" />
                    {name}
                  </span>
                </TableCell>
                <TableCell className="font-semibold tabular-nums">{s.pts}</TableCell>
                <TableCell>{s.oreb}</TableCell>
                <TableCell>{s.dreb}</TableCell>
                <TableCell>{s.ast}</TableCell>
                <TableCell>{s.stl}</TableCell>
                <TableCell>{s.blk}</TableCell>
                <TableCell>{s.tov}</TableCell>
                <TableCell>{s.pf}</TableCell>
                <TableCell>{sh.fgm}/{sh.fga}</TableCell>
                <TableCell>{sh.tpm}/{sh.tpa}</TableCell>
                <TableCell>{sh.ftm}/{sh.fta}</TableCell>
                <TableCell className="tabular-nums">
                  {tw >= 0 ? "+" : ""}
                  {tw.toFixed(1)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// Read-only box score for one game. The classic site opens Stat Entry (an editor) from a game
// card; entering/editing stats isn't part of this app yet, so this shows the result instead.
export function GameDetailDialog({
  state,
  game,
  onClose,
}: {
  state: PooleanState
  game: Game | null
  onClose: () => void
}) {
  return (
    <Dialog open={game !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        {game && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">
                {teamScore(game, game.teamA)} &ndash; {teamScore(game, game.teamB)}
              </DialogTitle>
              <DialogDescription>
                {formatDateDisplay(game.date)}
                {game.notes ? ` · ${game.notes}` : ""}
              </DialogDescription>
            </DialogHeader>
            {game.scoringEvents.length === 0 ? (
              <p className="text-muted-foreground">
                No shots logged for this game yet, so there is no box score to show.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                <TeamBoxScore state={state} game={game} ids={game.teamA} label="Team A" />
                <TeamBoxScore state={state} game={game} ids={game.teamB} label="Team B" />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
