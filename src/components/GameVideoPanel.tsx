import { useRef, useState } from "react"
import { Link2, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GameVideo } from "@/components/GameVideo"
import { getClient } from "@/lib/cloud"
import type { Update } from "@/lib/store"
import type { Game } from "@/lib/types"
import { deleteGameVideo, uploadGameVideo, videoPathFromUrl } from "@/lib/video"

export function GameVideoPanel({ game, update, readOnly }: { game: Game; update: Update; readOnly: boolean }) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [link, setLink] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const url = game.videoUrl || ""

  if (readOnly) return url ? <GameVideo url={url} /> : null

  const busy = progress !== null
  const cloudOn = !!getClient()
  const ownPath = game.videoPath || (url ? videoPathFromUrl(url) : null)
  const setVideo = (videoUrl: string | undefined, videoPath: string | undefined) =>
    update((s) => ({ ...s, games: s.games.map((g) => (g.id === game.id ? { ...g, videoUrl, videoPath } : g)) }))

  async function onFile(file: File | undefined) {
    if (!file) return
    setError("")
    setProgress(0)
    try {
      const old = ownPath
      const res = await uploadGameVideo(file, game.id, setProgress)
      setVideo(res.url, res.path)
      if (old) void deleteGameVideo(old).catch(() => {})
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
    if (!confirm("Remove this video from the game? An uploaded file is deleted for everyone.")) return
    setError("")
    try {
      if (ownPath) await deleteGameVideo(ownPath)
      setVideo(undefined, undefined)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the video.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <GameVideo url={url} />
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
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
