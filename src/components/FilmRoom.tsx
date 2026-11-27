import { useContext, useMemo, useState } from "react"
import { Clapperboard, Play } from "lucide-react"
import { ClipTile } from "@/components/ClipTile"
import { WatchContext } from "@/components/WatchTime"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PlayValue } from "@/lib/epa"
import { describe, gameFilm, opponentsOf, playerFilm, type Takeaway } from "@/lib/filmRoom"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { gameVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"
import type { Clip } from "@/lib/clips"
import type { Game, PooleanState } from "@/lib/types"

const signed = (x: number) => (x >= 0 ? `+${x.toFixed(1)}` : x.toFixed(1))
const pps = (t: Takeaway) => `${t.pps.toFixed(2)} points a shot (${t.shots})`

// A list of plays to watch. On a game page the Watch button jumps the game's video (WatchContext); elsewhere the chosen play plays here.
function Plays({ state, plays, title, empty, dated, onPick, picked }: { state: PooleanState; plays: PlayValue[]; title: string; empty: string; dated?: boolean; onPick: (p: PlayValue) => void; picked: string | null }) {
  const name = (id: string) => playerName(state, id)
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {plays.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {plays.map((p) => (
            <li key={p.gameId + p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className={cn("flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-sm hover:bg-muted", picked === p.gameId + p.id && "border-primary bg-muted")}
              >
                <Play aria-hidden className="mt-0.5 size-3.5 shrink-0 fill-current text-primary" />
                <span className="min-w-0 flex-1">
                  {describe(p, name)}
                  <span className="block text-xs text-muted-foreground">
                    {dated ? `${formatDateDisplay(p.date)} · ` : ""}
                    {signed(p.value)} points against an average trip
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// The chosen play, cut from its game's recording (for pages without the game's own video).
function Screen({ state, play }: { state: PooleanState; play: PlayValue | null }) {
  if (!play || play.t === null) return null
  const clip: Clip = { gameId: play.gameId, date: play.date, time: play.t, playerId: play.player, kind: "shot", label: describe(play, (id) => playerName(state, id)), score: 0 }
  return <ClipTile key={play.gameId + play.id} state={state} clip={clip} />
}

function usePicker(state: PooleanState) {
  const watch = useContext(WatchContext)
  const [picked, setPicked] = useState<PlayValue | null>(null)
  const pick = (p: PlayValue) => {
    setPicked(p)
    if (watch && p.t !== null) watch(p.t)
  }
  const game = picked ? state.games.find((g) => g.id === picked.gameId) : undefined
  const inline = !watch && !!game && !!gameVideoUrl(state, game)
  return { picked, pick, inline }
}

// Film tab on a game page: each team's plays that worked and did not, and what to take from them.
export function GameFilm({ state, game }: { state: PooleanState; game: Game }) {
  const film = useMemo(() => gameFilm(state, game.id), [state, game.id])
  const { picked, pick, inline } = usePicker(state)
  const any = film.some((t) => t.worked.length || t.didnt.length)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clapperboard aria-hidden className="size-5 text-accent" /> Film room
        </CardTitle>
        <p className="text-sm text-muted-foreground">The plays to watch from this game, valued by Points added: what worked, what did not, and what to adjust. Tap a play to watch it.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {inline && <Screen state={state} play={picked} />}
        {!any && <p className="text-sm text-muted-foreground">This game's shots have no video times yet, so there is nothing to watch.</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          {film.map((t) => {
            const label = t.side === 0 ? "Team A" : "Team B"
            const other = t.side === 0 ? "Team B" : "Team A"
            return (
              <section key={t.side} className="flex flex-col gap-3" aria-label={label}>
                <h3 className="flex items-center gap-2 font-display font-bold">
                  <span className="size-3 rounded-full" style={{ background: `var(--color-team-${t.side === 0 ? "a" : "b"})` }} /> {label}
                </h3>
                {(t.mine.best || t.hurt) && (
                  <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
                    {t.mine.best && t.mine.worst && (
                      <>
                        <li>
                          <span className="font-medium">Went in:</span> {t.mine.best.label}, {pps(t.mine.best)}
                        </li>
                        <li>
                          <span className="font-medium">Did not:</span> {t.mine.worst.label}, {pps(t.mine.worst)}
                        </li>
                      </>
                    )}
                    {t.hurt && (
                      <li>
                        <span className="font-medium">What hurt them:</span> {other}'s {t.hurt.label}, {pps(t.hurt)}
                      </li>
                    )}
                  </ul>
                )}
                <Plays state={state} plays={t.worked} title="What worked" empty="No standout plays with video." onPick={pick} picked={picked ? picked.gameId + picked.id : null} />
                <Plays state={state} plays={t.didnt} title="What did not" empty="No costly plays with video." onPick={pick} picked={picked ? picked.gameId + picked.id : null} />
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Film tab on the Player page: the player's own plays, their defense, and a chosen opponent, across every filmed game.
export function PlayerFilm({ state, pid }: { state: PooleanState; pid: string }) {
  const opponents = useMemo(() => opponentsOf(state, pid), [state, pid])
  const [vs, setVs] = useState<string>("")
  const film = useMemo(() => playerFilm(state, pid, vs || null), [state, pid, vs])
  const { picked, pick } = usePicker(state)
  const name = playerName(state, pid)
  const key = picked ? picked.gameId + picked.id : null
  if (!film.watchable)
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">No filmed plays for {name} yet. Once games with video are logged, the plays to watch show up here.</p>
        </CardContent>
      </Card>
    )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clapperboard aria-hidden className="size-5 text-accent" /> Film room
        </CardTitle>
        <p className="text-sm text-muted-foreground">{name}'s plays to watch from every filmed game, valued by Points added. Tap one to watch it here.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Screen state={state} play={picked} />
        {film.mine.best && film.mine.worst && (
          <ul className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3 text-sm">
            <li>
              <span className="font-medium">Goes in most:</span> {film.mine.best.label}, {pps(film.mine.best)}
            </li>
            <li>
              <span className="font-medium">Goes in least:</span> {film.mine.worst.label}, {pps(film.mine.worst)}
            </li>
          </ul>
        )}
        <div className="grid gap-5 lg:grid-cols-2">
          <Plays state={state} plays={film.worked} title="What worked" empty="No standout plays with video yet." dated onPick={pick} picked={key} />
          <Plays state={state} plays={film.didnt} title="What to fix" empty="No costly plays with video yet." dated onPick={pick} picked={key} />
          <Plays state={state} plays={film.stops} title="Stops on defense" empty="No stops with video yet." dated onPick={pick} picked={key} />
          <Plays state={state} plays={film.scoredOn} title="Scored on" empty="Nobody scored on them on video." dated onPick={pick} picked={key} />
        </div>
        {opponents.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <label className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Study an opponent</span>
              <select value={vs} onChange={(e) => setVs(e.target.value)} className="h-9 rounded-md border bg-background px-2">
                <option value="">Pick a player</option>
                {opponents.map((o) => (
                  <option key={o.id} value={o.id}>
                    {playerName(state, o.id)} ({o.n} {o.n === 1 ? "shot" : "shots"} between you)
                  </option>
                ))}
              </select>
            </label>
            {film.vs && (
              <>
                <p className="text-sm">
                  {name} against {playerName(state, film.vs.id)}: {film.vs.shotsOn ? `${film.vs.ppsOn.toFixed(2)} points a shot (${film.vs.shotsOn})` : "no shots"}.{" "}
                  {playerName(state, film.vs.id)} against {name}: {film.vs.shotsBy ? `${film.vs.ppsBy.toFixed(2)} points a shot (${film.vs.shotsBy})` : "no shots"}.
                </p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Plays state={state} plays={film.vs.offense.slice(0, 6)} title={`${name} shooting on ${playerName(state, film.vs.id)}`} empty="None on video." dated onPick={pick} picked={key} />
                  <Plays state={state} plays={film.vs.defense.slice(0, 6)} title={`${playerName(state, film.vs.id)} shooting on ${name}`} empty="None on video." dated onPick={pick} picked={key} />
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
