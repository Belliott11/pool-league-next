import { useEffect, useRef, type MutableRefObject } from "react"
import { cn } from "@/lib/utils"

// What stat entry needs from any video: the current time, and a way to jump and play.
export interface PlayerControl {
  time: () => number
  seek: (t: number) => void
  pause: () => void
}

interface YTPlayer {
  getCurrentTime: () => number
  seekTo: (t: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  destroy: () => void
}
type YTApi = { Player: new (el: HTMLElement, opts: { videoId: string; playerVars: Record<string, number>; events: { onReady: () => void } }) => YTPlayer }
declare global {
  interface Window {
    YT?: YTApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiReady: Promise<YTApi> | null = null
function loadApi(): Promise<YTApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiReady ??= new Promise<YTApi>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT as YTApi)
    }
    const s = document.createElement("script")
    s.src = "https://www.youtube.com/iframe_api"
    s.onerror = () => {
      apiReady = null
      reject(new Error("The YouTube player could not load."))
    }
    document.head.appendChild(s)
  })
  return apiReady
}

// A YouTube video whose time can be read, so a shot logged while watching gets its timestamp just like
// a video file does. The player is created once per video id.
export function YouTubePlayer({ id, control, className, start = 0 }: { id: string; control: MutableRefObject<PlayerControl | null>; className?: string; start?: number }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let player: YTPlayer | null = null
    let dead = false
    // The API replaces the element it is given, so it gets a fresh child that React does not own.
    const mount = document.createElement("div")
    host.current?.appendChild(mount)
    loadApi()
      .then((YT) => {
        if (dead) return
        player = new YT.Player(mount, {
          videoId: id,
          playerVars: { playsinline: 1, rel: 0, start: Math.floor(start) },
          events: {
            onReady: () => {
              control.current = {
                time: () => player?.getCurrentTime() ?? 0,
                seek: (t) => {
                  player?.seekTo(t, true)
                  player?.playVideo()
                },
                pause: () => player?.pauseVideo(),
              }
            },
          },
        })
      })
      .catch(() => {})
    return () => {
      dead = true
      control.current = null
      player?.destroy()
      host.current?.replaceChildren()
    }
  }, [id, control])
  return <div ref={host} className={cn("aspect-video w-full overflow-hidden rounded-xl bg-muted [&_iframe]:size-full", className)} />
}
