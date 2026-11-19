import { useMemo, useRef, useState } from "react"
import { ClipTile } from "@/components/ClipTile"
import { Button } from "@/components/ui/button"
import { gameClips, rawClips, reviewKey, type Clip } from "@/lib/clips"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { readFrame, type Frame } from "@/lib/stillCache"
import type { Update } from "@/lib/store"
import type { ClipReview, Game, PooleanState } from "@/lib/types"
import { gameVideoUrl, isDirectVideoUrl } from "@/lib/video"
import { Chip } from "@/pages/statentry/parts"

// Editors only: the plays that could make a good clip, game by game, newest first, the ones nobody has looked at on top. For each one: keep it
// or skip it, crop the picture, say who is in it and whether anyone looks good or rough. Kept clips rank first on the site, skipped ones
// are gone, and a clip marked rough for a player is kept off their own highlights and used only with stories about something going badly for them.
const WORTH = new Set<Clip["kind"]>(["marked", "dunk", "block", "three", "beat", "steal"])

function Card({ state, game, clip, review, save }: { state: PooleanState; game: Game; clip: Clip; review?: ClipReview; save: (r: ClipReview) => void }) {
  const url = gameVideoUrl(state, game)
  const key = reviewKey(clip)
  const [frame, setFrame] = useState<Frame | undefined>(review?.frame)
  const [note, setNote] = useState(review?.note ?? "")
  const [who, setWho] = useState<string[]>(review?.who ?? [clip.playerId])
  const [looks, setLooks] = useState<Record<string, "good" | "bad">>(review?.looks ?? {})
  const start = frame ?? readFrame(url) ?? { z: 1, x: 0.5, y: 0.5 }
  const set = (patch: Partial<Frame>) => setFrame({ ...start, ...patch })
  const people = [...game.teamA, ...game.teamB]
  const still = clip.kind === "still"
  const done = review ? (review.verdict === "keep" ? "Kept" : "Skipped") : null
  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  const look = (id: string, v: "good" | "bad") => setLooks((l) => { const n = { ...l }; if (n[id] === v) delete n[id]; else n[id] = v; return n })
  return (
    <li className="flex flex-col gap-3 border-t pt-3">
      <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
        <ClipTile state={state} clip={{ ...clip, frame }} className="w-64 max-w-full" />
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">{done ? `${done}. Change it below and save again.` : still ? "A still you picked." : "Not reviewed yet."}</p>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Describe it
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Two-handed dunk over Ben, everyone reacts" className="h-9 rounded-md border bg-background px-2 text-sm font-normal" />
            <span className="font-normal text-muted-foreground">Becomes the caption, and headlines that use the same words pick this clip.</span>
          </label>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium">Crop</legend>
            {([["z", "Zoom", 1, 2.5], ["x", "Across", 0, 1], ["y", "Down", 0, 1]] as const).map(([k, label, min, max]) => (
              <label key={k} className="flex items-center gap-2 text-xs">
                <span className="w-12 text-muted-foreground">{label}</span>
                <input type="range" min={min} max={max} step={0.02} value={start[k]} onChange={(e) => set({ [k]: Number(e.target.value) })} className="min-w-0 flex-1" />
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
            <Button size="sm" onClick={() => save({ key, verdict: "keep", ...(clip.kind === "still" ? { still: { time: clip.time, playerId: clip.playerId } } : {}), ...(note.trim() ? { note: note.trim() } : {}), ...(frame ? { frame } : {}), who, looks })}>Keep this clip</Button>
            <Button size="sm" variant="outline" onClick={() => save({ key, verdict: "skip", ...(clip.kind === "still" ? { still: { time: clip.time, playerId: clip.playerId } } : {}) })}>{clip.kind === "still" ? "Remove" : "Skip"}</Button>
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
  const [who, setWho] = useState(game.teamA[0] ?? "")
  if (!isDirectVideoUrl(url)) return <p className="text-xs text-muted-foreground">Stills need the game's video as a direct file, not a link to a page.</p>
  const people = [...game.teamA, ...game.teamB]
  return (
    <div className="flex flex-col gap-2">
      <video ref={video} src={`${url.split("#")[0]}#t=${game.videoStart ?? 0}`} controls playsInline preload="metadata" className="aspect-video w-full max-w-xl rounded-xl bg-muted" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          Of
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={who} onChange={(e) => setWho(e.target.value)}>
            {people.map((id) => <option key={id} value={id}>{playerName(state, id)}</option>)}
          </select>
        </label>
        <Button size="sm" disabled={!who} onClick={() => video.current && pick({ gameId: game.id, date: game.date, time: video.current.currentTime, playerId: who, kind: "still", label: "Still", score: 18 })}>Use this frame</Button>
      </div>
    </div>
  )
}

export function ReviewClips({ state, update }: { state: PooleanState; update: Update }) {
  const [gameId, setGameId] = useState<string | null>(null)
  const [ordinary, setOrdinary] = useState(false)
  const [drafts, setDrafts] = useState<Clip[]>([])
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
  const fresh = drafts.filter((d) => d.gameId === open.g.id && !reviewed(open.g).has(reviewKey(d)))
  const rows = [...saved, ...fresh, ...[...open.all].sort((a, b) => Number(reviewed(open.g).has(reviewKey(a))) - Number(reviewed(open.g).has(reviewKey(b))) || b.score - a.score)]
  const save = (r: ClipReview) => update((s) => ({ ...s, games: s.games.map((g) => (g.id === open.g.id ? { ...g, clipReviews: [...(g.clipReviews ?? []).filter((x) => x.key !== r.key), r] } : g)) }))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Which game" value={open.g.id} onChange={(e) => setGameId(e.target.value)}>
          {games.map((x) => <option key={x.g.id} value={x.g.id}>{formatDateDisplay(x.g.date)}, {todo(x)} to review</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={ordinary} onChange={(e) => setOrdinary(e.target.checked)} /> Include ordinary buckets
        </label>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Pick a still by hand</summary>
        <div className="mt-2"><StillPicker state={state} game={open.g} pick={(c) => setDrafts((d) => [...d, c])} /></div>
      </details>
      <ul className="flex flex-col gap-3">
        {rows.slice(0, 30).map((c) => <Card key={`${open.g.id}-${reviewKey(c)}`} state={state} game={open.g} clip={c} review={reviewed(open.g).get(reviewKey(c))} save={save} />)}
      </ul>
      {rows.length > 30 && <p className="text-xs text-muted-foreground">Showing the first 30 of {rows.length}; review these and the rest come up.</p>}
    </div>
  )
}
