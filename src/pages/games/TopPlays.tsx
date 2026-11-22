import { Clapperboard, Play } from "lucide-react"
import { useMemo } from "react"
import { ClipStrip } from "@/components/ClipTile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import trailer from "@/data/trailer.json"
import { bestClips } from "@/lib/clips"
import { seasonState } from "@/lib/offseason"
import type { PooleanState } from "@/lib/types"

const VIDEO_HOST = "https://pub-fe959ca0159c462e9b4e69082ac20db5.r2.dev" // the video bucket (see vite.config.ts)

// The season trailer: the season's best plays joined into one short video by the nightly clip run (scripts/cut-clips.mjs), only loaded
// once opened.
function Trailer() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="self-start" />}>
        <Play aria-hidden /> Watch the season trailer <span className="text-muted-foreground">{Math.floor(trailer.seconds / 60)}:{String(trailer.seconds % 60).padStart(2, "0")}</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogTitle>The season so far</DialogTitle>
        <video src={`${VIDEO_HOST}/${trailer.file}`} controls autoPlay muted playsInline preload="auto" className="aspect-video w-full rounded-lg bg-black" aria-label="Season trailer: the best plays of the season" />
      </DialogContent>
    </Dialog>
  )
}

// The season's best few plays on the home page, each with its own Share button: marked and kept highlights first (see bestClips), one per
// game, never one that goes badly for anyone.
export function TopPlays({ state }: { state: PooleanState }) {
  const clips = useMemo(() => bestClips(seasonState(state), { limit: 12, perGame: 1 }).filter((c) => !c.rough?.length).slice(0, 3), [state])
  if (clips.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clapperboard aria-hidden className="size-4 text-accent" /> Top plays of the season
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ClipStrip state={state} clips={clips} />
        {trailer.file && <Trailer />}
      </CardContent>
    </Card>
  )
}
