import { EmptyState } from "@/components/EmptyState"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PlayerChips, toggleId } from "@/components/PlayerChips"
import {
  EMPTY_FILTERS,
  gameMatchesFilters,
  STAT_FIELD_LABELS,
  type GameFilters,
  type StatField,
} from "@/lib/gameFilters"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import type { Update } from "@/lib/store"
import {
  gameDefenseStats,
  getGameStats,
  isBalancedGame,
  isCurrentSeasonGame,
  isLiveScoreOnly,
  liveScoreOf,
  shootingStats,
  teamScore,
  twoWayScore,
} from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

export const nativeSelect =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function names(state: PooleanState, ids: string[], fallback: string) {
  return ids.map((id) => playerName(state, id)).join(", ") || fallback
}

function signed(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`
}

// Best/worst performer of the game by Two-Way score, same as app.js's star/cold badges: only for
// a game with real shots and at least two players.
function bestAndWorst(state: PooleanState, game: Game) {
  const roster = [...game.teamA, ...game.teamB]
  if (game.scoringEvents.length === 0 || roster.length < 2) return null
  const perf = roster
    .filter((id) => state.players.some((p) => p.id === id))
    .map((id) => ({
      id,
      twoWay: twoWayScore(getGameStats(game, id), shootingStats(game, id), gameDefenseStats(game, id)),
    }))
  if (perf.length < 2) return null
  const best = perf.reduce((a, b) => (b.twoWay > a.twoWay ? b : a))
  const worst = perf.reduce((a, b) => (b.twoWay < a.twoWay ? b : a))
  return { best, worst: worst.id === best.id ? null : worst }
}

async function shareGame(state: PooleanState, game: Game) {
  const text = `${formatDateDisplay(game.date)}: ${names(state, game.teamA, "Team A")} ${teamScore(game, game.teamA)} - ${teamScore(game, game.teamB)} ${names(state, game.teamB, "Team B")}`
  const url = `${location.origin}${location.pathname}#game=${encodeURIComponent(game.id)}`
  if (navigator.share) {
    try {
      await navigator.share({ title: "Poolean Intel", text, url })
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") await navigator.clipboard?.writeText(`${text}\n${url}`)
    }
  } else {
    await navigator.clipboard?.writeText(`${text}\n${url}`)
  }
}

function GameCard({
  state,
  game,
  onOpen,
  onDelete,
}: {
  state: PooleanState
  game: Game
  onOpen: () => void
  onDelete: () => void
}) {
  const liveOnly = isLiveScoreOnly(game)
  const scoreA = liveOnly ? liveScoreOf(game, game.teamA) : teamScore(game, game.teamA)
  const scoreB = liveOnly ? liveScoreOf(game, game.teamB) : teamScore(game, game.teamB)
  const needsReview = game.scoringEvents.length === 0
  const hasVideo = !!(game.videoUrl || game.masterVideoId)
  const perf = bestAndWorst(state, game)
  const [shared, setShared] = useState(false)

  return (
    <Card className="cursor-pointer transition-transform active:scale-[0.99]" onClick={onOpen}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-col gap-0.5">
            {[
              { team: game.teamA, score: scoreA, fb: "Team A", won: scoreA > scoreB },
              { team: game.teamB, score: scoreB, fb: "Team B", won: scoreB > scoreA },
            ].map((t, i) => (
              <span key={i} className="flex items-baseline gap-3">
                <span className={`font-display w-9 text-right text-2xl font-extrabold tabular-nums ${t.won ? "text-primary" : ""}`}>{t.score}</span>
                <span className={`text-sm ${t.won ? "font-bold" : "text-muted-foreground"}`}>{names(state, t.team, t.fb)}</span>
              </span>
            ))}
          </div>
          {scoreA + scoreB > 0 && (
            <div
              role="img"
              aria-label={`Score split ${scoreA} to ${scoreB}`}
              className="flex h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted"
            >
              <span className={scoreA > scoreB ? "bg-primary" : "bg-muted-foreground/40"} style={{ width: `${(scoreA / (scoreA + scoreB)) * 100}%` }} />
              <span className={scoreB > scoreA ? "bg-primary" : "bg-muted-foreground/40"} style={{ width: `${(scoreB / (scoreA + scoreB)) * 100}%` }} />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>
              {formatDateDisplay(game.date)} &middot; {game.teamA.length + game.teamB.length} players
              {game.notes ? ` · ${game.notes}` : ""}
            </span>
            {hasVideo && <Badge variant="secondary">Video</Badge>}
            {hasVideo && needsReview && <Badge variant="secondary">Needs Review</Badge>}
            {game.liveInProgress && <Badge variant="secondary">Live now</Badge>}
            {!game.liveInProgress && liveOnly && <Badge variant="secondary">Live score only</Badge>}
            {!isBalancedGame(game) && (
              <Badge variant="secondary" title="Excluded from Leaderboard rates unless Include Imbalanced Games is on.">
                {game.teamA.length}v{game.teamB.length}
              </Badge>
            )}
            {!isCurrentSeasonGame(state, game) && <Badge variant="secondary">Past Season</Badge>}
            {game.stoppedEarly && (
              <Badge variant="secondary" title="This game ended early, so it is not comparable to a complete game.">
                Stopped Early
              </Badge>
            )}
            {perf && (
              <Badge className="bg-pos/15 text-pos" title="Best individual performance this game by Two-Way score.">
                {playerName(state, perf.best.id)} {signed(perf.best.twoWay)}
              </Badge>
            )}
            {perf?.worst && (
              <Badge variant="destructive" title="Worst individual performance this game by Two-Way score.">
                {playerName(state, perf.worst.id)} {signed(perf.worst.twoWay)}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await shareGame(state, game)
              setShared(true)
              setTimeout(() => setShared(false), 1500)
            }}
          >
            {shared ? "Shared" : "Share"}
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AdvancedFilters({
  state,
  filters,
  setFilters,
}: {
  state: PooleanState
  filters: GameFilters
  setFilters: (f: GameFilters) => void
}) {
  const players = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  const setStat = (patch: Partial<GameFilters["stat"]>) =>
    setFilters({ ...filters, stat: { ...filters.stat, ...patch } })
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <PlayerChips
          state={state}
          selected={filters.playerIds}
          onToggle={(id) => setFilters({ ...filters, playerIds: toggleId(filters.playerIds, id) })}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            className={nativeSelect}
            value={filters.teamMode}
            onChange={(e) => setFilters({ ...filters, teamMode: e.target.value as GameFilters["teamMode"] })}
          >
            <option value="either">On either team</option>
            <option value="together">On the same team</option>
            <option value="against">Against each other</option>
          </select>
          <label className="flex items-center gap-1">
            From
            <Input type="date" className="w-40" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </label>
          <label className="flex items-center gap-1">
            To
            <Input type="date" className="w-40" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select className={nativeSelect} value={filters.stat.playerId} onChange={(e) => setStat({ playerId: e.target.value })}>
            <option value="">Any player&hellip;</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={nativeSelect} value={filters.stat.field} onChange={(e) => setStat({ field: e.target.value as StatField })}>
            {(Object.keys(STAT_FIELD_LABELS) as StatField[]).map((f) => (
              <option key={f} value={f}>
                {STAT_FIELD_LABELS[f]}
              </option>
            ))}
          </select>
          <select className={nativeSelect} value={filters.stat.op} onChange={(e) => setStat({ op: e.target.value as GameFilters["stat"]["op"] })}>
            <option value="gte">at least</option>
            <option value="lte">at most</option>
            <option value="eq">exactly</option>
          </select>
          <Input type="number" className="w-24" placeholder="value" value={filters.stat.value} onChange={(e) => setStat({ value: e.target.value })} />
        </div>
      </CardContent>
    </Card>
  )
}

export function GameLog({
  state,
  update,
  onOpen,
}: {
  state: PooleanState
  update: Update
  onOpen: (game: Game) => void
}) {
  const [filters, setFilters] = useState<GameFilters>(EMPTY_FILTERS)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const games = useMemo(
    () =>
      [...state.games]
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
        .filter((g) => gameMatchesFilters(state, g, filters)),
    [state, filters],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="min-w-48 flex-1"
          placeholder="Filter by date, player, or notes..."
          value={filters.text}
          onChange={(e) => setFilters({ ...filters, text: e.target.value })}
        />
        <Button variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide Advanced Filters" : "Advanced Filters"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear Filters
        </Button>
      </div>
      {showAdvanced && <AdvancedFilters state={state} filters={filters} setFilters={setFilters} />}
      {state.games.length === 0 ? (
        <EmptyState title="No games yet" hint="Create a game below, then log its shots to start the record." />
      ) : games.length === 0 ? (
        <EmptyState title="No games match those filters" hint="Loosen or clear the filters to see more games." />
      ) : (
        games.map((g) => (
          <GameCard
            key={g.id}
            state={state}
            game={g}
            onOpen={() => onOpen(g)}
            onDelete={() => {
              if (!confirm("Delete this game and all its stats?")) return
              update((s) => ({ ...s, games: s.games.filter((x) => x.id !== g.id) }))
            }}
          />
        ))
      )}
    </div>
  )
}
