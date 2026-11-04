import { Gift, Share2, Sparkles } from "lucide-react"
import { useMemo, useState } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { turnout } from "@/lib/attendance"
import { formatDateDisplay, formatTime } from "@/lib/format"
import { seasonState } from "@/lib/offseason"
import { playerName } from "@/lib/players"
import { shareText } from "@/lib/shareText"
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"
import { useEvening } from "@/lib/weather"
import { Countdown } from "./Countdown"
import { PowerVoteCard, PredictionsCard } from "./Predictions"

const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`

// The way-too-early power ranking: this season's two-way per 20, at least 3 games, with each player's record.
export function powerRanking(state: PooleanState) {
  return computeLeaderboard(seasonState(state))
    .filter((r) => r.gp >= 3)
    .sort((a, b) => b.twoWayPer20 - a.twoWayPer20)
}

// The top of the Games tab between seasons: the countdown to opening night, who is in, an early power ranking, and the
// ways in to Wrapped and preseason predictions. The hall of fame has its own button at the top of Games all year.
export function OffseasonHub({ state, onWrapped, onOpenPlayer }: { state: PooleanState; onWrapped: () => void; onOpenPlayer: (id: string) => void }) {
  const o = state.openingNight!
  const weather = useEvening(o.date, o.time)
  const rsvp = (state.rsvps ?? []).find((r) => r.date === o.date)
  const coming = rsvp?.playerIds ?? []
  const t = useMemo(() => turnout(state, coming), [state, coming])
  const ranking = useMemo(() => powerRanking(state), [state])
  const [showAll, setShowAll] = useState(false)
  const [sent, setSent] = useState("")
  const shown = showAll ? ranking : ranking.slice(0, 5)
  const message = [
    `Poolean Intel: opening night ${formatDateDisplay(o.date)}${o.time ? `, ${formatTime(o.time)}` : ""}`,
    coming.length ? `In so far: ${coming.map((id) => playerName(state, id)).join(", ")}` : "",
    "",
    "Way too early power ranking:",
    ...ranking.slice(0, 5).map((r, i) => `${i + 1}. ${r.player.name} (${r.wins}-${r.losses})`),
  ]
    .filter((x, i) => x || i === 2)
    .join("\n")

  return (
    <section className="flex flex-col gap-4 rounded-xl border-2 border-accent/60 bg-card p-4" aria-label="Offseason">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Opening night</p>
        <h3 className="font-display text-2xl font-bold">
          {formatDateDisplay(o.date)}
          {o.time && <span className="text-muted-foreground">, {formatTime(o.time)}</span>}
        </h3>
        <Countdown date={o.date} time={o.time} className="font-display text-xl font-bold tabular-nums text-accent" />
        {weather && (
          <p className="text-sm text-muted-foreground">
            Cherry Hill, {hourLabel(weather.from)} to {hourLabel(weather.to)}: {weather.label}, <span className="tabular-nums">{weather.tempF}°F</span>, <span className="tabular-nums">{weather.rainPct}%</span> chance of rain
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{coming.length ? `${coming.length} in so far` : "Nobody has said they're in yet"}</p>
        {coming.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {coming.map((id) => (
              <span key={id} className="flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2.5 text-sm">
                <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
                {playerName(state, id)}
              </span>
            ))}
          </div>
        )}
        {coming.length > 0 && <p className="text-xs text-muted-foreground">{t.teams}.</p>}
      </div>

      <Button className="h-12 text-base" onClick={onWrapped}>
        <Gift aria-hidden /> See your Season Wrapped
      </Button>

      {ranking.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles aria-hidden className="size-4 text-gold" /> Way too early power ranking, by the numbers
          </h4>
          <p className="text-xs text-muted-foreground">Last season's two-way per 20, at least 3 games. Everyone starts at 0-0 on opening night.</p>
          <ol className="flex flex-col gap-1 text-sm">
            {shown.map((r, i) => (
              <li key={r.player.id} className="flex items-center gap-2">
                <span className="w-5 font-display font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline" onClick={() => onOpenPlayer(r.player.id)}>
                  <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
                  <span className="truncate font-medium">{r.player.name}</span>
                </button>
                <span className="tabular-nums text-muted-foreground">
                  {r.wins}-{r.losses}
                </span>
                <span className="w-10 text-right font-display font-bold tabular-nums">{r.twoWayPer20.toFixed(1)}</span>
              </li>
            ))}
          </ol>
          {ranking.length > 5 && (
            <button type="button" className="self-start text-sm font-medium text-accent" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show top 5" : `Show all ${ranking.length}`}
            </button>
          )}
        </div>
      )}

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

      <PowerVoteCard state={state} />
      <PredictionsCard state={state} />
    </section>
  )
}
