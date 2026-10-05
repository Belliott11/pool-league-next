import { useRef, useState, type MutableRefObject } from "react"
import type { PlayerControl } from "@/components/YouTubePlayer"
import { Link2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GameVideo } from "@/components/GameVideo"
import { getClient } from "@/lib/cloud"
import { formatDateDisplay, uid } from "@/lib/format"
import { formatVideoTime, parseVideoTimeInput } from "@/lib/legacy-core"
import type { Update } from "@/lib/store"
import type { Game, PooleanState } from "@/lib/types"
import { deleteGameVideo, gameVideoUrl, masterOf, uploadGameVideo, videoPathFromUrl } from "@/lib/video"

// Several games can point at one recording (a whole night on one video). Each game then keeps its own
// "starts at" time, and the file is only deleted when no other game still uses it.
export function GameVideoPanel({ state, game, update, readOnly, control }: { state: PooleanState; game: Game; update: Update; readOnly: boolean; control?: MutableRefObject<PlayerControl | null> }) {
  const games = state.games
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [link, setLink] = useState("")
  const [startText, setStartText] = useState<string | null>(null)
  const [endText, setEndText] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const master = masterOf(state, game)
  const url = gameVideoUrl(state, game)
  // A game in a master recording (carried over from the classic site) sets the video once for the whole
  // group; its own start and end times stay per game.
  const useMaster = !!master && !game.videoUrl
  const groupSize = master ? games.filter((g) => g.masterVideoId === master.id).length : 0

  if (readOnly) return url ? <GameVideo url={url} start={game.videoStart} control={control} /> : null

  const busy = progress !== null
  const cloudOn = !!getClient()
  const ownPath = (useMaster ? master?.path : game.videoPath) || (url ? videoPathFromUrl(url) : null)
  const setVideo = (videoUrl: string | undefined, videoPath: string | undefined, videoStart?: number) =>
    update((s) =>
      useMaster
        ? { ...s, masterVideos: (s.masterVideos ?? []).map((m) => (m.id === master!.id ? { ...m, url: videoUrl, path: videoPath } : m)) }
        : { ...s, games: s.games.map((g) => (g.id === game.id ? { ...g, videoUrl, videoPath, ...(videoStart !== undefined ? { videoStart } : {}) } : g)) },
    )
  // Another game uses this same recording, so its file must stay.
  const sharedWithOthers = (u: string) => (useMaster ? false : games.some((g) => g.id !== game.id && (g.videoUrl === u || masterOf(state, g)?.url === u)))
  // Recordings other games already have, one entry per distinct video, for "use the same video".
  const reusable = useMaster ? [] : [...new Map(games.filter((g) => g.id !== game.id && g.videoUrl && g.videoUrl !== url).map((g) => [g.videoUrl as string, g])).values()]
  const startSeconds = game.videoStart ?? 0

  async function onFile(file: File | undefined) {
    if (!file) return
    setError("")
    setProgress(0)
    try {
      const old = ownPath
      const oldUrl = url
      const res = await uploadGameVideo(file, game.id, setProgress)
      setVideo(res.url, res.path)
      if (old && !sharedWithOthers(oldUrl)) void deleteGameVideo(old).catch(() => {})
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.")
    } finally {
      setProgress(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function saveLink() {
    const v = link.trim()
    if (!/^https?:\/\//i.test(v)) return setError("Paste a full link that starts with http:// or https://.")
    setError("")
    setVideo(v, undefined)
    setLink("")
  }

  async function remove() {
    const shared = sharedWithOthers(url)
    const text = useMaster
      ? `Remove this video from all ${groupSize} games that share it?`
      : shared
        ? "Remove this video from this game? Other games keep using it."
        : "Remove this video from the game? An uploaded file is deleted for everyone."
    if (!confirm(text)) return
    setError("")
    try {
      if (ownPath && !shared) await deleteGameVideo(ownPath)
      setVideo(undefined, undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the video.")
    }
  }

  function useExisting(from: string) {
    const src = games.find((g) => g.videoUrl === from)
    if (!src?.videoUrl) return
    setError("")
    setVideo(src.videoUrl, src.videoPath, 0)
    setStartText(null)
  }

  // Shared recordings: put this game in one (or make a new one), and say where it ends inside it.
  const masters = state.masterVideos ?? []
  const setGame = (patch: Partial<Game>) => update((s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? { ...g, ...patch } : g)) }))
  function joinRecording(id: string) {
    if (!id) return
    setGame({ masterVideoId: id, videoStart: 0 })
  }
  function makeRecording() {
    const name = newName.trim()
    if (!name) return
    const id = uid("master")
    update((s) => ({
      ...s,
      masterVideos: [...(s.masterVideos ?? []), { id, name }],
      games: s.games.map((g) => (g.id === game.id ? { ...g, masterVideoId: id, videoStart: 0 } : g)),
    }))
    setNewName("")
  }
  function saveEnd() {
    const text = (endText ?? "").trim()
    const secs = text === "" ? null : parseVideoTimeInput(text)
    if (text !== "" && (secs === null || secs === undefined || Number.isNaN(secs) || secs <= startSeconds)) return setError("Type the end as m:ss, after the start.")
    setError("")
    setGame({ videoEnd: secs })
    setEndText(null)
  }

  function saveStart() {
    const text = (startText ?? "").trim()
    const secs = text === "" ? 0 : parseVideoTimeInput(text)
    if (secs === null || secs === undefined || Number.isNaN(secs) || secs < 0) return setError("Type the start as m:ss, for example 42:10.")
    setError("")
    update((s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? { ...g, videoStart: secs > 0 ? secs : undefined } : g)) }))
    setStartText(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {master && (
        <p className="text-sm text-muted-foreground">
          Part of the recording <span className="font-medium text-foreground">{master.name}</span>, shared by {groupSize} game{groupSize === 1 ? "" : "s"}. {url ? "Set where this game starts below." : "Add the video once and every game in it gets it."}
        </p>
      )}
      <GameVideo key={`${url}|${startSeconds}`} url={url} start={startSeconds} control={control} />
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="video/*" className="sr-only" aria-label="Choose a video file to upload" disabled={!cloudOn || busy} onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" disabled={!cloudOn || busy} onClick={() => fileRef.current?.click()}>
          <Upload aria-hidden /> {url ? "Replace video" : "Upload video"}
        </Button>
        {url && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void remove()}>
            <Trash2 aria-hidden /> Remove
          </Button>
        )}
      </div>
      {!cloudOn && <p className="text-xs text-muted-foreground">Uploads need the shared-data cloud, which is not set up here. Pasting a link still works.</p>}
      {progress !== null && (
        <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      <div className="flex gap-2">
        <Input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Or paste a video link" aria-label="Video link" disabled={busy} onKeyDown={(e) => e.key === "Enter" && saveLink()} />
        <Button type="button" variant="outline" disabled={busy || !link.trim()} onClick={saveLink}>
          <Link2 aria-hidden /> Save link
        </Button>
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Shared recording</p>
        {master ? (
          <>
            <p className="text-xs text-muted-foreground">
              This game is part of <span className="font-medium text-foreground">{master.name}</span>. Set where it starts and ends in that recording.
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="numeric"
                value={endText ?? (typeof game.videoEnd === "number" ? formatVideoTime(game.videoEnd) : "")}
                onChange={(e) => setEndText(e.target.value)}
                placeholder="This game ends at (m:ss)"
                aria-label="Where this game ends in the video"
                disabled={busy}
                onKeyDown={(e) => e.key === "Enter" && saveEnd()}
              />
              <Button type="button" variant="outline" disabled={busy || endText === null} onClick={saveEnd}>
                Set end
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setGame({ masterVideoId: null, videoStart: 0, videoEnd: null })}>
              Take this game out of the recording
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">One recording of the whole night? Put each game in it, then add the video once.</p>
            {masters.length > 0 && (
              <select className="h-10 rounded-md border bg-background px-2 text-sm" value="" onChange={(e) => joinRecording(e.target.value)} disabled={busy} aria-label="Put this game in a shared recording">
                <option value="">Put this game in a recording</option>
                {masters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Or name a new recording, such as Oct 4 night" aria-label="Name for a new shared recording" onKeyDown={(e) => e.key === "Enter" && makeRecording()} />
              <Button type="button" variant="outline" disabled={!newName.trim()} onClick={makeRecording}>
                Create
              </Button>
            </div>
          </>
        )}
      </div>
      {reusable.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Or use a video another game already has</span>
          <select className="h-10 rounded-md border bg-background px-2" value="" onChange={(e) => e.target.value && useExisting(e.target.value)} disabled={busy}>
            <option value="">Choose a game's video</option>
            {reusable.map((g) => (
              <option key={g.id} value={g.videoUrl}>
                {formatDateDisplay(g.date)}: {g.teamA.length + g.teamB.length} players
              </option>
            ))}
          </select>
        </label>
      )}
      {url && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              value={startText ?? (startSeconds > 0 ? formatVideoTime(startSeconds) : "")}
              onChange={(e) => setStartText(e.target.value)}
              placeholder="This game starts at (m:ss)"
              aria-label="Where this game starts in the video"
              disabled={busy}
              onKeyDown={(e) => e.key === "Enter" && saveStart()}
            />
            <Button type="button" variant="outline" disabled={busy || startText === null} onClick={saveStart}>
              Set start
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">One recording for the whole night? Set where this game begins and the video opens there.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
