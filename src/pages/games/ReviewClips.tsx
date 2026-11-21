import { useMemo, useRef, useState } from "react"
import { CutPreview } from "@/components/CutPreview"
import { Button } from "@/components/ui/button"
import { gameClips, rawClips, reviewKey, type Clip } from "@/lib/clips"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { readFrame, type Frame } from "@/lib/stillCache"
import type { TrackPoint } from "@/lib/track"
import type { Update } from "@/lib/store"
import type { ClipReview, Game, PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { Chip } from "@/pages/statentry/parts"

// Editors only: the plays that could make a good clip, game by game, newest first, the ones nobody has looked at on top. For each one: keep it
// or skip it, crop the picture, say who is in it and whether anyone looks good or rough. Kept clips rank first on the site, skipped ones
// are gone, and a clip marked rough for a player is kept off their own highlights and used only with stories about something going badly for them.
const WORTH = new Set<Clip["kind"]>(["marked", "winner", "dunk", "contested", "block", "three", "beat", "steal", "lowlight"])

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`

// What the logged play is, before any description of yours: the label, who, when in the recording, and what was tagged on it.
function original(state: PooleanState, game: Game, clip: Clip): string {
  if (clip.kind === "still") return `A frame you picked, of ${playerName(state, clip.playerId)}, at ${clock(clip.time)} in the recording.`
  const e = game.scoringEvents.find((x) => x.videoTime === clip.time && (x.scorerId === clip.playerId || x.blockerId === clip.playerId))
  const bits = [
    e?.points ? `${e.points} points${e.made === false ? ", missed" : ""}` : null,
    e?.shotType ? `${e.shotType.replace(/_/g, " ")}` : null,
    e?.contestLevel ? `${e.contestLevel} contest` : null,
    e?.assistId ? `assist by ${playerName(state, e.assistId)}` : null,
  ].filter(Boolean)
  return `${clip.label} by ${playerName(state, clip.playerId)}, at ${clock(clip.time)} in the recording${bits.length ? `. Logged as ${bits.join(", ")}` : ""}.`
}

function Card({ state, game, clip, review, save, makeStill, followMode }: { state: PooleanState; game: Game; clip: Clip; review?: ClipReview; save: (r: ClipReview, was?: string) => void; makeStill?: (c: Clip) => void; followMode?: boolean }) {
  const url = gameVideoUrl(state, game)
  const was = reviewKey(clip)
  const [frame, setFrame] = useState<Frame | undefined>(review?.frame)
  const [track, setTrack] = useState<TrackPoint[]>(review?.track ?? [])
  const [from, setFrom] = useState(review?.from ?? clip.from ?? Math.max(0, clip.time - 2))
  const [to, setTo] = useState(review?.to ?? clip.to ?? clip.time + 4)
  const [at, setAt] = useState(clip.time) // a still's moment, once moved
  const key = clip.kind === "still" ? reviewKey({ time: at, playerId: clip.playerId, kind: "still" }) : was
  const [note, setNote] = useState(review?.note ?? "")
  const [who, setWho] = useState<string[]>(review?.who ?? [clip.playerId])
  const [looks, setLooks] = useState<Record<string, "good" | "bad">>(review?.looks ?? {})
  const start = frame ?? readFrame(url) ?? { z: track.length ? 2 : 1.5, x: 0.5, y: 0.5 } // zoomed a little to start, because Across and Down move nothing at zoom 1
  const set = (patch: Partial<Frame>) => setFrame({ ...start, ...patch })
  const people = [...game.teamA, ...game.teamB]
  const still = clip.kind === "still"
  const done = review ? (review.verdict === "keep" ? "Kept" : "Skipped") : null
  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  const look = (id: string, v: "good" | "bad") => setLooks((l) => { const n = { ...l }; if (n[id] === v) delete n[id]; else n[id] = v; return n })
  return (
    <li className="@container flex flex-col gap-3 border-t pt-3">
      <div className="grid gap-3 @3xl:grid-cols-[minmax(0,28rem)_1fr]">
        <CutPreview state={state} game={game} time={at} frame={frame} track={track} onTrack={clip.kind === "still" ? undefined : setTrack} from={from} to={to} still={clip.kind === "still"} onFrom={setFrom} onTo={setTo} onTime={setAt} onStillFrom={makeStill && ((t) => makeStill({ ...clip, time: t, kind: "still", label: "Still", from: undefined, to: undefined, score: 18 }))} />
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          <p className="text-sm font-medium">{original(state, game, clip)}</p>
          <p className="text-xs text-muted-foreground">{done ? `${done}. Change it below and save again.` : still ? (review ? "A still you picked, saved." : "Not saved yet. Press Save this still to keep it.") : "Not reviewed yet."}</p>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Describe it
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Two-handed dunk over Ben, everyone reacts" className="h-9 rounded-md border bg-background px-2 text-sm font-normal" />
            <span className="font-normal text-muted-foreground">Not shown on the site. Headlines that use the same words pick this clip.</span>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium">Crop</legend>
            {([["z", "Zoom", 1, 2.5], ["x", "Across", 0, 1], ["y", "Down", 0, 1]] as const).filter(([k]) => k === "z" || !track.length).map(([k, label, min, max]) => (
              <label key={k} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-muted-foreground">{label}</span>
                <input type="range" min={min} max={max} step={0.02} value={start[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="min-w-0 flex-1" />
                <span className="w-9 text-right tabular-nums text-muted-foreground">{k === "z" ? `${start.z.toFixed(1)}x` : `${Math.round(start[k] * 100)}%`}</span>
              </label>
            ))}
            {frame && <button type="button" className="self-start text-xs text-muted-foreground underline" onClick={() => setFrame(undefined)}>Back to the automatic crop</button>}
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium">Who is in it</legend>
            <div className="flex flex-wrap gap-1.5">
              {people.map((id) => <Chip key={id} onClick={() => toggle(id)} selected={who.includes(id)}>{playerName(state, id)}</Chip>)}
            </div>
          </fieldset>
          {who.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="text-xs font-medium">How they come across</legend>
              {who.map((id) => (
                <div key={id} className="flex flex-wrap items-center gap-1.5">
                  <span className="w-20 truncate">{playerName(state, id)}</span>
                  <Chip onClick={() => look(id, "good")} selected={looks[id] === "good"}>Looks good</Chip>
                  <Chip onClick={() => look(id, "bad")} selected={looks[id] === "bad"}>Looks rough</Chip>
                </div>
              ))}
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save({ key, verdict: "keep", ...(clip.kind === "still" ? { still: { time: at, playerId: clip.playerId } } : { from, to }), ...(note.trim() ? { note: note.trim() } : {}), ...(frame || track.length ? { frame: frame ?? { z: 2, x: 0.5, y: 0.5 } } : {}), ...(track.length || followMode ? { track } : {}), who, looks }, was)}>{clip.kind === "still" ? "Save this still" : followMode ? "Save and mark done" : "Keep this clip"}</Button>
            <Button size="sm" variant="outline" onClick={() => save({ key: was, verdict: "skip", ...(clip.kind === "still" ? { still: { time: clip.time, playerId: clip.playerId } } : {}) })}>{clip.kind === "still" ? "Remove" : "Skip"}</Button>
          </div>
        </div>
      </div>
    </li>
  )
}

// Pick a frame by hand: scrub the recording to the moment, say who it is of, then the card below sets the rest (crop, who, how they come across).
function StillPicker({ state, game, pick }: { state: PooleanState; game: Game; pick: (c: Clip) => void }) {
  const url = gameVideoUrl(state, game)
  const video = useRef<HTMLVideoElement>(null)
  const [who, setWho] = useState("")
  const [added, setAdded] = useState(false)
  if (!isDirectVideoUrl(url)) return <p className="text-xs text-muted-foreground">Stills need the game's video as a direct file, not a link to a page.</p>
  const people = [...game.teamA, ...game.teamB]
  return (
    <div className="flex flex-col gap-2">
      <video ref={video} src={`${url.split("#")[0]}#t=${game.videoStart ?? 0}`} controls playsInline preload="metadata" className="aspect-video w-full max-w-xl rounded-xl bg-muted" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          Of
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="" disabled>Choose a player</option>
            {people.map((id) => <option key={id} value={id}>{playerName(state, id)}</option>)}
          </select>
        </label>
        <Button size="sm" disabled={!who} onClick={() => video.current && (pick({ gameId: game.id, date: game.date, time: video.current.currentTime, playerId: who, kind: "still", label: "Still", score: 18 }), setAdded(true))}>Start a still from this frame</Button>
        {added && <span className="text-xs text-muted-foreground">A still card is at the top of the list below. Press Save this still there.</span>}
      </div>
    </div>
  )
}

// Writes one review onto its game. Removing a still deletes it, rather than leaving a "skip" behind.
function saveReview(update: Update, gameId: string, r: ClipReview, was?: string) {
  const entry = r.still && r.verdict === "skip" ? [] : [r]
  update((s) => ({ ...s, games: s.games.map((g) => (g.id === gameId ? { ...g, clipReviews: [...(g.clipReviews ?? []).filter((x) => x.key !== r.key && x.key !== was), ...entry] } : g)) }))
}

// One player's clips and stills, to look at and edit: everything kept, rough or marked in which they are the player or are in the shot.
const playerItems = (state: PooleanState, pid: string) =>
  state.games.flatMap((g) => gameClips(state, g).filter((c) => (c.reviewed || c.marked || c.kind === "lowlight") && (c.playerId === pid || c.who?.includes(pid))).map((c) => ({ g, c })))

export function PlayerClipsPanel({ state, update, pid }: { state: PooleanState; update: Update; pid: string }) {
  const [open, setOpen] = useState(false)
  const items = useMemo(() => playerItems(state, pid), [state, pid])
  return (
    <details className="rounded-lg border p-2" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer text-sm font-medium">Clips and stills ({items.length})</summary>
      {open && (items.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">None yet. Keep a clip or pick a still in Review clips on the Export tab.</p> : (
        <ul className="mt-2 flex flex-col gap-3">
          {items.map(({ g, c }) => <Card key={`${g.id}-${reviewKey(c)}`} state={state} game={g} clip={c} review={(g.clipReviews ?? []).find((r) => r.key === reviewKey(c))} save={(r, was) => saveReview(update, g.id, r, was)} />)}
        </ul>
      ))}
    </details>
  )
}

// Kept clips that have not been looked at for following yet: tap the ball or player and follow it, or save to say none is needed. Either
// way the clip leaves this list.
function FollowBackfill({ state, update }: { state: PooleanState; update: Update }) {
  const rows = useMemo(
    () => state.games.flatMap((g) => gameClips(state, g).filter((c) => c.reviewed && c.kind !== "still" && (g.clipReviews ?? []).find((r) => r.key === reviewKey(c))?.track === undefined).map((c) => ({ g, c }))),
    [state],
  )
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Every kept clip has been looked at for following.</p>
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{rows.length} kept clip{rows.length === 1 ? "" : "s"} to look at. Scrub to the ball or player, tap it, press "Follow it on to the end", watch it with "Play the cut", then "Save and mark done". Save without tapping when no following is needed.</p>
      <ul className="flex flex-col gap-3">
        {rows.slice(0, 20).map(({ g, c }) => <Card key={`${g.id}-${reviewKey(c)}`} state={state} game={g} clip={c} review={(g.clipReviews ?? []).find((r) => r.key === reviewKey(c))} save={(r, was) => saveReview(update, g.id, r, was)} followMode />)}
      </ul>
      {rows.length > 20 && <p className="text-xs text-muted-foreground">Showing the first 20 of {rows.length}.</p>}
    </div>
  )
}

export function ReviewClips({ state, update }: { state: PooleanState; update: Update }) {
  const [view, setView] = useState<"new" | "follow">("new")
  if (view === "follow") return <div className="flex flex-col gap-3"><ViewSwitch view={view} setView={setView} /><FollowBackfill state={state} update={update} /></div>
  return <div className="flex flex-col gap-3"><ViewSwitch view={view} setView={setView} /><ReviewList state={state} update={update} /></div>
}

function ViewSwitch({ view, setView }: { view: "new" | "follow"; setView: (v: "new" | "follow") => void }) {
  return (
    <div className="flex gap-2" role="group" aria-label="What to review">
      <Chip selected={view === "new"} onClick={() => setView("new")}>Plays to review</Chip>
      <Chip selected={view === "follow"} onClick={() => setView("follow")}>Kept clips to follow</Chip>
    </div>
  )
}

function ReviewList({ state, update }: { state: PooleanState; update: Update }) {
  const [gameId, setGameId] = useState<string | null>(null)
  const [ordinary, setOrdinary] = useState(false)
  const [drafts, setDrafts] = useState<Clip[]>([])
  const [showReviewed, setShowReviewed] = useState(false)
  const games = useMemo(
    () => state.games.filter((g) => gameVideoUrl(state, g) && !g.liveInProgress).map((g) => ({ g, all: rawClips(state, g).filter((c) => ordinary || WORTH.has(c.kind)) })).filter((x) => x.all.length).sort((a, b) => b.g.date.localeCompare(a.g.date)),
    [state, ordinary],
  )
  if (games.length === 0) return <p className="text-sm text-muted-foreground">No filmed game has a play worth reviewing yet.</p>
  const open = (gameId && games.find((x) => x.g.id === gameId)) || games[0]
  const reviewed = (g: Game) => new Map((g.clipReviews ?? []).map((r) => [r.key, r]))
  const todo = (x: (typeof games)[number]) => x.all.filter((c) => !reviewed(x.g).has(reviewKey(c))).length
  // Stills already saved on this game come first, then the frame just picked, then the logged plays.
  const saved = gameClips(state, open.g).filter((c) => c.kind === "still")
  const fresh = drafts.filter((d) => d.gameId === open.g.id && reviewed(open.g).get(reviewKey(d))?.verdict !== "keep") // an old "skip" left by an earlier Remove must not hide a new still
  // Once a play is kept or skipped, or a still saved, it leaves this list (it is on the player's card on the Players page); "Show reviewed" brings them back.
  const rows = [...(showReviewed ? saved : []), ...fresh, ...[...open.all].filter((c) => showReviewed || !reviewed(open.g).has(reviewKey(c))).sort((a, b) => Number(reviewed(open.g).has(reviewKey(a))) - Number(reviewed(open.g).has(reviewKey(b))) || b.score - a.score)]
  const save = (r: ClipReview, was?: string) => {
    // The card that was just saved (or removed) stops being a draft, whatever frame it was moved to.
    setDrafts((d) => d.filter((x) => ![r.key, was].includes(reviewKey(x))))
    saveReview(update, open.g.id, r, was)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Which game" value={open.g.id} onChange={(e) => setGameId(e.target.value)}>
          {games.map((x) => <option key={x.g.id} value={x.g.id}>{formatDateDisplay(x.g.date)}, {todo(x)} to review</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={ordinary} onChange={(e) => setOrdinary(e.target.checked)} /> Include ordinary buckets
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showReviewed} onChange={(e) => setShowReviewed(e.target.checked)} /> Show reviewed
        </label>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Pick a still by hand</summary>
        <div className="mt-2"><StillPicker state={state} game={open.g} pick={(c) => setDrafts((d) => [...d, c])} /></div>
      </details>
      <ul className="flex flex-col gap-3">
        {rows.slice(0, 30).map((c) => <Card key={`${open.g.id}-${reviewKey(c)}`} state={state} game={open.g} clip={c} review={c.kind === "still" && reviewed(open.g).get(reviewKey(c))?.verdict !== "keep" ? undefined : reviewed(open.g).get(reviewKey(c))} save={save} makeStill={(s) => setDrafts((d) => [...d, s])} />)}
      </ul>
      {rows.length > 30 && <p className="text-xs text-muted-foreground">Showing the first 30 of {rows.length}; review these and the rest come up.</p>}
    </div>
  )
}
