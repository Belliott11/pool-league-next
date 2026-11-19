import { useMemo, useState } from "react"
import { ClipTile } from "@/components/ClipTile"
import { Button } from "@/components/ui/button"
import { rawClips, reviewKey, type Clip } from "@/lib/clips"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { readFrame, type Frame } from "@/lib/stillCache"
import type { Update } from "@/lib/store"
import type { ClipReview, Game, PooleanState } from "@/lib/types"
import { gameVideoUrl } from "@/lib/video"
import { Chip } from "@/pages/statentry/parts"

// Editors only: the plays that could make a good clip, game by game, newest first, the ones nobody has looked at on top. For each one: keep it
// or skip it, crop the picture, say who is in it and whether anyone looks good or rough. Kept clips rank first on the site, skipped ones
// are gone, and a player marked rough stays out of their own pages for that clip.
const WORTH = new Set<Clip["kind"]>(["marked", "dunk", "block", "three", "beat", "steal"])

function Card({ state, game, clip, review, save }: { state: PooleanState; game: Game; clip: Clip; review?: ClipReview; save: (r: ClipReview) => void }) {
  const url = gameVideoUrl(state, game)
  const key = reviewKey(clip)
  const [frame, setFrame] = useState<Frame | undefined>(review?.frame)
  const [who, setWho] = useState<string[]>(review?.who ?? [clip.playerId])
  const [looks, setLooks] = useState<Record<string, "good" | "bad">>(review?.looks ?? {})
  const start = frame ?? readFrame(url) ?? { z: 1, x: 0.5, y: 0.5 }
  const set = (patch: Partial<Frame>) => setFrame({ ...start, ...patch })
  const people = [...game.teamA, ...game.teamB]
  const done = review ? (review.verdict === "keep" ? "Kept" : "Skipped") : null
  const toggle = (id: string) => setWho((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]))
  const look = (id: string, v: "good" | "bad") => setLooks((l) => { const n = { ...l }; if (n[id] === v) delete n[id]; else n[id] = v; return n })
  return (
    <li className="flex flex-col gap-3 border-t pt-3">
      <div className="grid gap-3 sm:grid-cols-[16rem_1fr]">
        <ClipTile state={state} clip={{ ...clip, frame }} className="w-64 max-w-full" />
        <div className="flex min-w-0 flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">{done ? `${done}. Change it below and save again.` : "Not reviewed yet."}</p>
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
            <Button size="sm" onClick={() => save({ key, verdict: "keep", ...(frame ? { frame } : {}), who, looks })}>Keep this clip</Button>
            <Button size="sm" variant="outline" onClick={() => save({ key, verdict: "skip" })}>Skip</Button>
          </div>
        </div>
      </div>
    </li>
  )
}

export function ReviewClips({ state, update }: { state: PooleanState; update: Update }) {
  const [gameId, setGameId] = useState<string | null>(null)
  const [ordinary, setOrdinary] = useState(false)
  const games = useMemo(
    () => state.games.filter((g) => gameVideoUrl(state, g) && !g.liveInProgress).map((g) => ({ g, all: rawClips(state, g).filter((c) => ordinary || WORTH.has(c.kind)) })).filter((x) => x.all.length).sort((a, b) => b.g.date.localeCompare(a.g.date)),
    [state, ordinary],
  )
  if (games.length === 0) return <p className="text-sm text-muted-foreground">No filmed game has a play worth reviewing yet.</p>
  const open = (gameId && games.find((x) => x.g.id === gameId)) || games[0]
  const reviewed = (g: Game) => new Map((g.clipReviews ?? []).map((r) => [r.key, r]))
  const todo = (x: (typeof games)[number]) => x.all.filter((c) => !reviewed(x.g).has(reviewKey(c))).length
  const rows = [...open.all].sort((a, b) => Number(reviewed(open.g).has(reviewKey(a))) - Number(reviewed(open.g).has(reviewKey(b))) || b.score - a.score)
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
      <ul className="flex flex-col gap-3">
        {rows.slice(0, 30).map((c) => <Card key={`${open.g.id}-${reviewKey(c)}`} state={state} game={open.g} clip={c} review={reviewed(open.g).get(reviewKey(c))} save={save} />)}
      </ul>
      {rows.length > 30 && <p className="text-xs text-muted-foreground">Showing the first 30 of {rows.length}; review these and the rest come up.</p>}
    </div>
  )
}
