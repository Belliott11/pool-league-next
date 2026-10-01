import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { playerName } from "@/lib/players"
import { teamScore } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

function TeamNames({ state, ids }: { state: PooleanState; ids: string[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {ids.map((id) => (
        <span key={id} className="flex items-center gap-1">
          <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
          <span className="text-sm font-medium">{playerName(state, id)}</span>
        </span>
      ))}
    </div>
  )
}

function GameCard({ state, game }: { state: PooleanState; game: Game }) {
  const hasShots = game.scoringEvents.length > 0
  const scoreA = hasShots ? teamScore(game, game.teamA) : null
  const scoreB = hasShots ? teamScore(game, game.teamB) : null
  const balanced = game.teamA.length === game.teamB.length

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <TeamNames state={state} ids={game.teamA} />
          <span className="font-display text-2xl font-bold tabular-nums text-muted-foreground">
            {hasShots ? `${scoreA} – ${scoreB}` : "vs"}
          </span>
          <TeamNames state={state} ids={game.teamB} />
        </div>
        <div className="flex items-center gap-2">
          {!balanced && <Badge variant="secondary">uneven teams</Badge>}
          {game.stoppedEarly && <Badge variant="secondary">stopped early</Badge>}
          <span className="text-sm text-muted-foreground">{game.date}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function GamesPage({ state }: { state: PooleanState }) {
  const games = [...state.games].sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  if (games.length === 0) {
    return <p className="text-muted-foreground">No games logged yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {games.map((g) => (
        <GameCard key={g.id} state={state} game={g} />
      ))}
    </div>
  )
}
