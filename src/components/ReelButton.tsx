import { useState } from "react"
import { Play, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import mixtapes from "@/data/mixtapes.json"
import nightReels from "@/data/night-reels.json"
import { shareVideo } from "@/lib/shareFile"
import { VIDEO_HOST } from "@/lib/clipShare"

const table = mixtapes as Record<string, { file: string; seconds: number }>
const len = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

// A player's mixtape (their best plays of the season, made by the nightly clip run, scripts/cut-clips.mjs), in a dialog; nothing loads
// until it is opened. Nothing shows for a player without one (fewer than three good plays).
export function MixtapeButton({ pid, name }: { pid: string; name: string }) {
  const t = table[pid]
  if (!t) return null
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" className="self-start" />}>
        <Play aria-hidden /> Watch {name}'s mixtape <span className="text-muted-foreground">{len(t.seconds)}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>{name}'s mixtape</DialogTitle>
        <video src={`${VIDEO_HOST}/${t.file}`} controls autoPlay muted playsInline preload="auto" className="aspect-video w-full rounded-lg bg-black" aria-label={`${name}'s best plays of the season`} />
      </DialogContent>
    </Dialog>
  )
}

const nights = nightReels as Record<string, { file: string; vertical: string; seconds: number }>

// The night in 60 seconds (the night's best plays, made by the nightly clip run, scripts/cut-clips.mjs), in a dialog, with its vertical
// copy for Instagram stories handed to the share sheet as a file (else downloaded). Nothing shows for a night without one.
export function NightReelButton({ date, label }: { date: string; label: string }) {
  const n = nights[date]
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (!n) return null
  const share = async () => {
    setBusy(true)
    setFailed(false)
    try {
      await shareVideo(`${VIDEO_HOST}/${n.vertical}`, `poolean-intel-${date}.mp4`, `${label} in 60 seconds`)
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger render={<Button size="sm" />}>
          <Play aria-hidden /> The night in 60 seconds <span className="opacity-80">{len(n.seconds)}</span>
        </DialogTrigger>
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle>{label} in 60 seconds</DialogTitle>
          <video src={`${VIDEO_HOST}/${n.file}`} controls autoPlay muted playsInline preload="auto" className="aspect-video w-full rounded-lg bg-black" aria-label={`The best plays of ${label}`} />
        </DialogContent>
      </Dialog>
      {n.vertical && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void share()}>
          <Smartphone aria-hidden /> {failed ? "That did not work. Try again" : busy ? "Getting the video" : "Story video"}
        </Button>
      )}
    </div>
  )
}
