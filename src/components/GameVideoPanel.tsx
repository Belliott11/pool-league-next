import { useRef, useState } from "react"
import { Link2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GameVideo } from "@/components/GameVideo"
import { getClient } from "@/lib/cloud"
import { formatDateDisplay } from "@/lib/format"
import { formatVideoTime, parseVideoTimeInput } from "@/lib/legacy-core"
import type { Update } from "@/lib/store"
import type { Game } from "@/lib/types"
import { deleteGameVideo, uploadGameVideo, videoPathFromUrl } from "@/lib/video"

// Several games can point at one recording (a whole night on one video). Each game then keeps its own
// "starts at" time, and the file is only deleted when no other game still uses it.
export function GameVideoPanel({ game, games, update, readOnly }: { game: Game; games: Game[]; update: Update; readOnly: boolean }) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [link, setLink] = useState("")
  const [startText, setStartText] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const url = game.videoUrl || ""

  if (readOnly) return url ? <GameVideo url={url} start={game.videoStart} /> : null

  const busy = progress !== null
  const cloudOn = !!getClient()
  const ownPath = game.videoPath || (url ? videoPathFromUrl(url) : null)
  const setVideo = (videoUrl: string | undefined, videoPath: string | undefined, videoStart?: number) =>
    update((s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? { ...g, videoUrl, videoPath, videoStart } : g)) }))
  // Another game uses this same recording, so its file must stay.
  const sharedWithOthers = (u: string) => games.some((g) => g.id !== game.id && g.videoUrl === u)
  // Recordings other games already have, one entry per distinct video, for "use the same video".
  const reusable = [...new Map(games.filter((g) => g.id !== game.id && g.videoUrl && g.videoUrl !== url).map((g) => [g.videoUrl as string, g])).values()]
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
    if (!confirm(shared ? "Remove this video from this game? Other games keep using it." : "Remove this video from the game? An uploaded file is deleted for everyone.")) return
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
      <GameVideo key={`${url}|${startSeconds}`} url={url} start={startSeconds} />
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
