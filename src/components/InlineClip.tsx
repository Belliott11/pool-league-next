import { useEffect, useRef } from "react"
import { GameVideo } from "@/components/GameVideo"
import type { PlayerControl } from "@/components/YouTubePlayer"
import type { Game, PooleanState } from "@/lib/types"
import { gameVideoUrl } from "@/lib/video"

const LEAD = 5 // seconds of run-up before the play, as the game page's Watch buttons
const TRIES = 40

// One moment of a game's video, played right where it is opened.
export function InlineClip({ state, game, time }: { state: PooleanState; game: Game; time: number | null }) {
  const control = useRef<PlayerControl | null>(null)
  useEffect(() => {
    if (time === null) return
    // A YouTube player takes a moment to be ready.
    let tries = 0
    const timer = setInterval(() => {
      if (control.current || ++tries > TRIES) {
        clearInterval(timer)
        control.current?.seek(Math.max(0, time - LEAD))
      }
    }, 250)
    return () => clearInterval(timer)
  }, [time])
  return <GameVideo url={gameVideoUrl(state, game)} start={game.videoStart} control={control} />
}
