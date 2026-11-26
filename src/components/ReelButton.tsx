import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import mixtapes from "@/data/mixtapes.json"

const VIDEO_HOST = "https://pub-fe959ca0159c462e9b4e69082ac20db5.r2.dev" // the video bucket (see vite.config.ts)
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
