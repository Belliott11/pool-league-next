import { Check, Gift, Radio, Share2, Sparkles } from "lucide-react"
import { FlipDigits } from "@/components/FlipDigits"
import { findLiveGame, liveTotals } from "@/lib/live"
import { scoreOf } from "@/lib/nightRecap"
import { TEAM } from "@/lib/teamColors"
import { cn } from "@/lib/utils"
import { LiveOddsMini } from "@/pages/live/LiveOdds"
import { useMemo, useState } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { turnout } from "@/lib/attendance"
import { formatDateLong, formatTime } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { useReadOnly } from "@/lib/mode"
import { wrappedPlayers } from "@/lib/wrapped"
import { isOpeningNight } from "@/lib/offseason"
import { playerName } from "@/lib/players"
import { shareText } from "@/lib/shareText"
import type { Game, PooleanState } from "@/lib/types"
import { useEvening } from "@/lib/weather"
import { Countdown } from "./Countdown"
import { PlayersToWatch } from "./PlayersToWatch"
import { jumpPicks } from "@/lib/predictions"
import { JumpPicksCard, PredictionsCard, usePredictions } from "./Predictions"

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`

// The top of the Games tab between seasons: the countdown to opening night, who is in, who the group expects to make a jump, and the
// ways in to Wrapped and preseason predictions. The hall of fame has its own button at the top of Games all year.
export function OffseasonHub({ state, onWrapped, onOpenPlayer, onLive, onOpenGame }: { state: PooleanState; onWrapped: () => void; onOpenPlayer: (id: string) => void; onLive: () => void; onOpenGame: (g: Game) => void }) {
  const o = state.openingNight!
  const readOnly = useReadOnly()
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const hasWrapped = !!me && wrappedPlayers(state).includes(me)
  const tonight = isOpeningNight(state)
  const liveGame = findLiveGame(state)
  const tonightsGames = state.games.filter((g) => g.date === o.date && !g.liveInProgress)
  const playedTonight = new Set(state.games.filter((g) => g.date === o.date).flatMap((g) => [...g.teamA, ...g.teamB]))
  const weather = useEvening(o.date, o.time)
  const rsvp = (state.rsvps ?? []).find((r) => r.date === o.date)
  const coming = rsvp?.playerIds ?? []
  const t = useMemo(() => turnout(state, coming), [state, coming])
  const p = usePredictions(state)
  const picks = useMemo(() => jumpPicks(p.entries).filter((r) => state.players.some((x) => x.id === r.id)), [p.entries, state.players])
  const pickers = p.entries.filter((e) => (e.picks.jumps ?? []).length > 0).length
  const [sent, setSent] = useState("")
  const message = [
    `Poolean Intel: opening night ${formatDateLong(o.date)}${o.time ? `, ${formatTime(o.time)}` : ""}`,
    coming.length ? `In so far: ${coming.map((id) => playerName(state, id)).join(", ")}` : "",
    "",
    picks.length ? `Predicted to make a jump, from ${pickers} ${pickers === 1 ? "person" : "people"}:` : "",
    ...picks.slice(0, 5).map((r) => `${playerName(state, r.id)} (${r.votes})`),
  ]
    .filter((x, i) => x || i === 2)
    .join("\n")

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 border-accent/60 bg-card p-4" aria-label="Offseason">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{tonight ? "Opening night is tonight" : "Opening night"}</p>
        <h3 className="font-display text-2xl font-bold">
          {formatDateLong(o.date)}
          {o.time && <span className="text-muted-foreground">, {formatTime(o.time)}</span>}
        </h3>
        <p className="text-xs text-muted-foreground">Cherry Hill time.</p>
        <Countdown date={o.date} time={o.time} className="font-display text-xl font-bold tabular-nums text-accent" />
        {weather && (
          <p className="text-sm text-muted-foreground">
            Cherry Hill, {hourLabel(weather.from)} to {hourLabel(weather.to)}: {weather.label}, <span className="tabular-nums">{weather.tempF}°F</span>, <span className="tabular-nums">{weather.rainPct}%</span> chance of rain
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">
          {tonight ? (coming.length ? `${coming.length} said they're in. ${coming.filter((id) => playedTonight.has(id)).length} have played so far.` : "Who's here") : coming.length ? `${coming.length} in so far` : `Nobody is on the list yet. ${readOnly ? "The editor adds RSVPs." : "Add RSVPs under Set Up Tonight."}`}
        </p>
        {coming.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {coming.map((id) => (
              <span key={id} className={cn("flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-sm", tonight && playedTonight.has(id) && "border-pos")}>
                <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
                {playerName(state, id)}
                {tonight && playedTonight.has(id) && <Check aria-label="has played tonight" className="size-3.5 text-pos" />}
              </span>
            ))}
          </div>
        )}
        {coming.length > 0 && <p className="text-xs text-muted-foreground">{t.teams}.</p>}
      </div>

      {tonight && liveGame && (
        <button type="button" onClick={onLive} className="flex flex-col gap-2 rounded-xl border-2 border-primary bg-background p-3 text-left">
          <span className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Radio aria-hidden className="size-4 animate-pulse" /> Live now
          </span>
          <span className="flex items-center gap-3 text-4xl">
            <span className={TEAM.A.text}>
              <FlipDigits value={liveTotals(liveGame)[0]} />
            </span>
            <span className="text-2xl text-muted-foreground">-</span>
            <span className={TEAM.B.text}>
              <FlipDigits value={liveTotals(liveGame)[1]} />
            </span>
          </span>
          <LiveOddsMini game={liveGame} />
          <span className="text-sm text-muted-foreground">Tap to watch.</span>
        </button>
      )}

      {tonight && tonightsGames.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="text-sm font-semibold">Tonight so far</h4>
          {tonightsGames.map((g) => {
            const [a, b] = scoreOf(g)
            return (
              <button key={g.id} type="button" onClick={() => onOpenGame(g)} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
                <span className="min-w-0 flex-1 truncate">
                  {g.teamA.map((id) => playerName(state, id)).join(", ")} <span className="text-muted-foreground">vs</span> {g.teamB.map((id) => playerName(state, id)).join(", ")}
                </span>
                <span className="font-display font-bold tabular-nums">
                  <span className={a > b ? TEAM.A.text : ""}>{a}</span>-<span className={b > a ? TEAM.B.text : ""}>{b}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!tonight && hasWrapped && (
        <Button className="h-12 text-base" onClick={onWrapped}>
          <Gift aria-hidden /> See your Season Wrapped
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles aria-hidden className="size-4 text-gold" /> Predicted players to watch
        </h4>
        {picks.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nobody has picked yet. {tonight ? "" : "Pick who makes a jump below."}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Who the group thinks will make a jump, from {pickers} {pickers === 1 ? "person" : "people"}.</p>
            <ul className="flex flex-col gap-1 text-sm">
              {picks.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline" onClick={() => onOpenPlayer(r.id)}>
                    <PlayerAvatar id={r.id} name={playerName(state, r.id)} size="sm" />
                    <span className="truncate font-medium">{playerName(state, r.id)}</span>
                  </button>
                  <span className="shrink-0 font-display font-bold tabular-nums">{r.votes}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!tonight && <PlayersToWatch state={state} onOpenPlayer={onOpenPlayer} />}

      <Button
        size="sm"
        variant="outline"
        className="self-start"
        onClick={async () => {
          setSent(await shareText(message))
          setTimeout(() => setSent(""), 2000)
        }}
      >
        <Share2 aria-hidden /> {sent === "copied" ? "Copied" : sent === "failed" ? "Could not share" : "Share for the group chat"}
      </Button>

      <JumpPicksCard state={state} p={p} />
      <PredictionsCard state={state} p={p} />
    </section>
  )
}
