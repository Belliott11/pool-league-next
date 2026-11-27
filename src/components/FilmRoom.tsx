import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Clapperboard, ListVideo, Play, Repeat, Share2, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { clipSource } from "@/lib/clipCuts"
import { getClient } from "@/lib/cloud"
import { ownerHash } from "@/lib/deviceKey"
import type { PlayValue } from "@/lib/epa"
import { addNote, deleteNote, loadNotes, noteKey, type FilmNote } from "@/lib/filmNotes"
import { beatenBy, describe, gameFilm, opponentsOf, playerFilm, type Takeaway } from "@/lib/filmRoom"
import { formatDateDisplay } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { playerName } from "@/lib/players"
import { SITE } from "@/lib/site"
import { gameVideoUrl } from "@/lib/video"
import { cn } from "@/lib/utils"
import type { Game, PooleanState } from "@/lib/types"

const signed = (x: number) => (x >= 0 ? `+${x.toFixed(1)}` : x.toFixed(1))
const pps = (t: Takeaway) => `${t.pps.toFixed(2)} points a shot (${t.shots})`
const LEAD = 4 // seconds of the play shown before its logged moment
const TAIL = 3 // and after it
const SPEEDS = [1, 0.5, 0.25]
export const playLink = (p: PlayValue) => `${SITE}#/games/film/${encodeURIComponent(`${p.gameId}.${p.id}`)}`

// ---- notes (supabase/filmNotes.sql): loaded once for the whole page, shared by every list.
interface Notes {
  byPlay: Map<string, FilmNote[]>
  me: string
  refresh: () => void
}
function useNotes(): Notes {
  const [all, setAll] = useState<FilmNote[]>([])
  const [me, setMe] = useState("")
  const refresh = useCallback(() => {
    const c = getClient()
    if (c) void loadNotes(c).then(setAll)
  }, [])
  useEffect(() => {
    void ownerHash().then(setMe)
    refresh()
  }, [refresh])
  const byPlay = useMemo(() => {
    const m = new Map<string, FilmNote[]>()
    for (const n of all) m.set(noteKey(n.gameId, n.eventId), [...(m.get(noteKey(n.gameId, n.eventId)) ?? []), n])
    return m
  }, [all])
  return { byPlay, me, refresh }
}

function PlayNotes({ state, play, notes }: { state: PooleanState; play: PlayValue; notes: Notes }) {
  const client = getClient()
  const who = myPlayerId(useWho(), state.players)
  const [text, setText] = useState("")
  const [msg, setMsg] = useState("")
  const list = notes.byPlay.get(noteKey(play.gameId, play.id)) ?? []
  if (!client) return null
  const send = async () => {
    const t = text.trim()
    if (!t) return
    const ok = await addNote(client, play.gameId, play.id, t, who)
    setMsg(ok ? "" : "That note did not save. Notes are up to 280 characters, 40 a day per phone.")
    if (ok) setText("")
    notes.refresh()
  }
  return (
    <div className="flex flex-col gap-1.5">
      {list.length > 0 && (
        <ul className="flex flex-col gap-1">
          {list.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{n.author ? playerName(state, n.author) : "Someone"}:</span> {n.note}
              </span>
              {n.owner === notes.me && (
                <button type="button" aria-label="Delete your note" className="text-muted-foreground hover:text-foreground" onClick={() => void deleteNote(client, n.id).then(notes.refresh)}>
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <Input value={text} maxLength={280} onChange={(e) => setText(e.target.value)} placeholder="Add a note on this play" aria-label="Add a note on this play" className="h-9" />
        <Button size="sm" type="submit" disabled={!text.trim()}>
          Add
        </Button>
      </form>
      {msg && <p className="text-xs text-destructive">{msg}</p>}
    </div>
  )
}

// ---- where the shot was taken, on a small half court (basket at the bottom; 0..100 across and up from the basket's end).
function MiniCourt({ p }: { p: PlayValue }) {
  if (!p.spot) return <span className="w-11 shrink-0" aria-hidden />
  const x = Math.max(4, Math.min(96, p.spot.x))
  const y = 72 - Math.max(0, Math.min(100, p.spot.y)) * 0.66
  return (
    <svg viewBox="0 0 100 80" className="h-9 w-11 shrink-0 rounded border border-border bg-muted/40" role="img" aria-label={`Shot from ${p.spot.x < 35 ? "the left" : p.spot.x > 65 ? "the right" : "the middle"}, ${p.spot.y < 25 ? "close in" : p.spot.y < 55 ? "mid range" : "far out"}`}>
      <path d="M 12 80 L 12 60 A 38 38 0 0 1 88 60 L 88 80" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <circle cx="50" cy="74" r="4" fill="none" stroke="currentColor" strokeOpacity="0.6" strokeWidth="2" />
      <circle cx={x} cy={y} r="7" className={p.made ? "fill-primary" : "fill-none stroke-primary"} strokeWidth="3" />
    </svg>
  )
}

// ---- the viewer: one play at a time from its game's recording (its short cut when there is one), with speed, loop, and the list.
function FilmViewer({ state, queue, index, onIndex, onClose, notes }: { state: PooleanState; queue: PlayValue[]; index: number; onIndex: (i: number) => void; onClose: () => void; notes: Notes }) {
  const play = queue[index]
  const video = useRef<HTMLVideoElement>(null)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(false)
  const [copied, setCopied] = useState(false)
  const game = state.games.find((g) => g.id === play?.gameId)
  const url = game ? gameVideoUrl(state, game) : ""
  const src = play && play.t !== null && url ? clipSource(url, { time: play.t }) : null
  const start = src && play.t !== null ? Math.max(0, play.t - LEAD - src.offset) : 0
  const end = src && play.t !== null ? play.t + TAIL - src.offset : 0
  useEffect(() => {
    const v = video.current
    if (v) v.playbackRate = speed
  }, [speed, index])
  if (!play || !src) return null
  const onTime = () => {
    const v = video.current
    if (!v || v.currentTime < end) return
    if (loop) v.currentTime = start
    else if (index < queue.length - 1) onIndex(index + 1)
    else v.pause()
  }
  const share = async () => {
    const link = playLink(play)
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    try {
      if (nav.share) await nav.share({ title: "Poolean Intel film", text: describe(play, (id) => playerName(state, id)), url: link })
      else {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      /* closed the share sheet */
    }
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-2">
      <video
        key={`${play.gameId}|${play.id}|${src.src}`}
        ref={video}
        src={`${src.src}#t=${start.toFixed(2)}`}
        className="aspect-video w-full rounded-lg bg-black"
        playsInline
        muted
        autoPlay
        controls
        preload="auto"
        onLoadedMetadata={(e) => {
          e.currentTarget.currentTime = start
          e.currentTarget.playbackRate = speed
          void e.currentTarget.play().catch(() => {})
        }}
        onTimeUpdate={onTime}
      />
      <p className="px-1 text-sm">
        {describe(play, (id) => playerName(state, id))}{" "}
        <span className="text-muted-foreground">
          {formatDateDisplay(play.date)}
          {queue.length > 1 ? ` · play ${index + 1} of ${queue.length}` : ""}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <div className="flex overflow-hidden rounded-md border" role="group" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={cn("px-2.5 py-1 text-xs tabular-nums", speed === s ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {s === 1 ? "1x" : `${s}x`}
            </button>
          ))}
        </div>
        <Button size="sm" variant={loop ? "default" : "outline"} aria-pressed={loop} onClick={() => setLoop(!loop)}>
          <Repeat aria-hidden /> Loop
        </Button>
        {queue.length > 1 && (
          <>
            <Button size="sm" variant="outline" disabled={index === 0} onClick={() => onIndex(index - 1)} aria-label="Previous play">
              <ChevronLeft aria-hidden />
            </Button>
            <Button size="sm" variant="outline" disabled={index === queue.length - 1} onClick={() => onIndex(index + 1)} aria-label="Next play">
              <ChevronRight aria-hidden />
            </Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={() => void share()}>
          <Share2 aria-hidden /> {copied ? "Link copied" : "Send this play"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close the viewer" className="ml-auto">
          <X aria-hidden />
        </Button>
      </div>
      <div className="px-1 pb-1">
        <PlayNotes state={state} play={play} notes={notes} />
      </div>
    </div>
  )
}

// The viewer's queue: one play, or a whole list played back to back.
function useViewer() {
  const [queue, setQueue] = useState<PlayValue[]>([])
  const [index, setIndex] = useState(0)
  const open = (list: PlayValue[], i: number) => {
    setQueue(list)
    setIndex(i)
  }
  return { queue, index, setIndex, open, close: () => setQueue([]), current: queue[index] ?? null }
}

// A list of plays: the spot, the play in words, its value, notes count. Tap to watch; "Watch all" plays the list in order.
function Plays({ state, plays, title, empty, dated, viewer, notes }: { state: PooleanState; plays: PlayValue[]; title: string; empty: string; dated?: boolean; viewer: ReturnType<typeof useViewer>; notes: Notes }) {
  const name = (id: string) => playerName(state, id)
  const cur = viewer.current
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {plays.length > 1 && (
          <button type="button" onClick={() => viewer.open(plays, 0)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ListVideo aria-hidden className="size-3.5" /> Watch all {plays.length}
          </button>
        )}
      </div>
      {plays.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {plays.map((p, i) => {
            const n = notes.byPlay.get(noteKey(p.gameId, p.id))?.length ?? 0
            return (
              <li key={p.gameId + p.id}>
                <button
                  type="button"
                  onClick={() => viewer.open(plays, i)}
                  className={cn("flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-sm hover:bg-muted", cur && cur.gameId === p.gameId && cur.id === p.id && "border-primary bg-muted")}
                >
                  <MiniCourt p={p} />
                  <span className="min-w-0 flex-1">
                    {describe(p, name)}
                    <span className="block text-xs text-muted-foreground">
                      {dated ? `${formatDateDisplay(p.date)} · ` : ""}
                      {signed(p.value)} points against an average trip
                      {n ? ` · ${n} ${n === 1 ? "note" : "notes"}` : ""}
                    </span>
                  </span>
                  <Play aria-hidden className="mt-0.5 size-3.5 shrink-0 fill-current text-primary" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// The viewer, kept in view at the top of the card while a play is open.
function Stage({ state, viewer, notes }: { state: PooleanState; viewer: ReturnType<typeof useViewer>; notes: Notes }) {
  if (!viewer.current) return null
  return (
    <div className="z-10 lg:sticky lg:top-20">
      <FilmViewer state={state} queue={viewer.queue} index={viewer.index} onIndex={viewer.setIndex} onClose={viewer.close} notes={notes} />
    </div>
  )
}

// Film tab on a game page: each team's plays that worked and did not, and what to take from them.
export function GameFilm({ state, game }: { state: PooleanState; game: Game }) {
  const film = useMemo(() => gameFilm(state, game.id), [state, game.id])
  const viewer = useViewer()
  const notes = useNotes()
  const any = film.some((t) => t.worked.length || t.didnt.length)
  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clapperboard aria-hidden className="size-5 text-accent" /> Film room
        </CardTitle>
        <p className="text-sm text-muted-foreground">The plays to watch from this game, valued by Points added: what worked, what did not, and what to adjust. Tap a play to watch it, slow it down or loop it.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Stage state={state} viewer={viewer} notes={notes} />
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
                <Plays state={state} plays={t.worked} title="What worked" empty="No standout plays with video." viewer={viewer} notes={notes} />
                <Plays state={state} plays={t.didnt} title="What did not" empty="No costly plays with video." viewer={viewer} notes={notes} />
              </section>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// Film tab on the Player page: the player's own plays, their defense (and how they got beaten), and a chosen opponent.
export function PlayerFilm({ state, pid }: { state: PooleanState; pid: string }) {
  const opponents = useMemo(() => opponentsOf(state, pid), [state, pid])
  const [vs, setVs] = useState<string>("")
  const film = useMemo(() => playerFilm(state, pid, vs || null), [state, pid, vs])
  const beaten = useMemo(() => beatenBy(state, pid), [state, pid])
  const viewer = useViewer()
  const notes = useNotes()
  const name = playerName(state, pid)
  if (!film.watchable)
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">No filmed plays for {name} yet. Once games with video are logged, the plays to watch show up here.</p>
        </CardContent>
      </Card>
    )
  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clapperboard aria-hidden className="size-5 text-accent" /> Film room
        </CardTitle>
        <p className="text-sm text-muted-foreground">{name}'s plays to watch from every filmed game, valued by Points added. Tap one to watch it, slow it down or loop it, or watch a whole list.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Stage state={state} viewer={viewer} notes={notes} />
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
          <Plays state={state} plays={film.worked} title="What worked" empty="No standout plays with video yet." dated viewer={viewer} notes={notes} />
          <Plays state={state} plays={film.didnt} title="What to fix" empty="No costly plays with video yet." dated viewer={viewer} notes={notes} />
          <Plays state={state} plays={film.stops} title="Stops on defense" empty="No stops with video yet." dated viewer={viewer} notes={notes} />
          <Plays state={state} plays={film.scoredOn} title="Scored on" empty="Nobody scored on them on video." dated viewer={viewer} notes={notes} />
        </div>
        {beaten.length > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">How {name} got beaten</h4>
            <ul className="flex flex-col gap-1.5 text-sm">
              {beaten.slice(0, 5).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{playerName(state, b.id)}</span> got past {name} {b.times} {b.times === 1 ? "time" : "times"} ({b.made} scored):{" "}
                    <span className="text-muted-foreground">{b.how.map((h) => `${h.n} ${h.label}`).join(", ")}</span>
                  </span>
                  {b.plays.length > 0 && (
                    <button type="button" onClick={() => viewer.open(b.plays, 0)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <ListVideo aria-hidden className="size-3.5" /> Watch {b.plays.length === 1 ? "it" : `all ${b.plays.length}`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
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
                  <Plays state={state} plays={film.vs.offense.slice(0, 6)} title={`${name} shooting on ${playerName(state, film.vs.id)}`} empty="None on video." dated viewer={viewer} notes={notes} />
                  <Plays state={state} plays={film.vs.defense.slice(0, 6)} title={`${playerName(state, film.vs.id)} shooting on ${name}`} empty="None on video." dated viewer={viewer} notes={notes} />
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// A shared play (#/games/film/<game>.<play>): the play in the viewer, with its notes.
export function FilmPlay({ state, play }: { state: PooleanState; play: PlayValue }) {
  const notes = useNotes()
  const [index, setIndex] = useState(0)
  return <FilmViewer state={state} queue={[play]} index={index} onIndex={setIndex} onClose={() => history.back()} notes={notes} />
}

// The viewer for any list of plays, for other screens (the live screens' film before you play).
export function PlaysToWatch({ state, plays, label }: { state: PooleanState; plays: PlayValue[]; label: string }) {
  const viewer = useViewer()
  const notes = useNotes()
  if (!plays.length) return null
  return (
    <div className="flex flex-col gap-2">
      {viewer.current ? (
        <FilmViewer state={state} queue={viewer.queue} index={viewer.index} onIndex={viewer.setIndex} onClose={viewer.close} notes={notes} />
      ) : (
        <button type="button" onClick={() => viewer.open(plays, 0)} className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
          <ListVideo aria-hidden className="size-3.5" /> {label}
        </button>
      )}
    </div>
  )
}
