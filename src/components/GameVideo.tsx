import { useEffect, useRef, type MutableRefObject, type Ref } from "react"
import { ExternalLink } from "lucide-react"
import { EmptyState } from "@/components/EmptyState"
import { YouTubePlayer, type PlayerControl } from "@/components/YouTubePlayer"
import { embedKind, youtubeId } from "@/lib/video"
import { cn } from "@/lib/utils"

function embedSrc(url: string, kind: "youtube" | "vimeo", start = 0): string | null {
  try {
    const u = new URL(url)
    if (kind === "vimeo") {
      const id = u.pathname.split("/").filter(Boolean).pop()
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}${start > 0 ? `#t=${Math.floor(start)}s` : ""}` : null
    }
    const id = u.hostname.includes("youtu.be")
      ? u.pathname.slice(1)
      : u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
    return id ? `https://www.youtube-nocookie.com/embed/${id}${start > 0 ? `?start=${Math.floor(start)}` : ""}` : null
  } catch {
    return null
  }
}

function FileVideo({ url, videoRef, className, onTimeUpdate, start, control }: { url: string; videoRef?: Ref<HTMLVideoElement>; className?: string; onTimeUpdate?: (t: number) => void; start: number; control?: MutableRefObject<PlayerControl | null> }) {
  const own = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (!control) return
    control.current = {
      time: () => own.current?.currentTime ?? 0,
      seek: (t) => {
        const v = own.current
        if (!v) return
        v.currentTime = Math.max(0, t)
        void v.play().catch(() => {})
      },
      pause: () => own.current?.pause(),
    }
    return () => {
      control.current = null
    }
  }, [control])
  return (
    <video
      ref={(el) => {
        own.current = el
        if (typeof videoRef === "function") videoRef(el)
        else if (videoRef) (videoRef as MutableRefObject<HTMLVideoElement | null>).current = el
      }}
      src={url}
      controls
      playsInline
      preload="metadata"
      className={cn("aspect-video w-full rounded-xl bg-muted", className)}
      onLoadedMetadata={(e) => {
        if (start > 0) e.currentTarget.currentTime = start
      }}
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
    />
  )
}

// `control` lets the page jump the video to a moment (the "Watch" times in the box score). Vimeo and other
// embeds cannot be controlled from here, so they just play.
export function GameVideo({ url, videoRef, className, onTimeUpdate, start = 0, control }: { url?: string | null; videoRef?: Ref<HTMLVideoElement>; className?: string; onTimeUpdate?: (t: number) => void; start?: number; control?: MutableRefObject<PlayerControl | null> }) {
  if (!url) return <EmptyState className={className} title="No video yet" hint="Add a video to this game to watch it here." />
  const kind = embedKind(url)
  if (kind === "file") return <FileVideo url={url} videoRef={videoRef} className={className} onTimeUpdate={onTimeUpdate} start={start} control={control} />
  const yt = kind === "youtube" ? youtubeId(url) : null
  if (yt && control) return <YouTubePlayer key={`${yt}|${start}`} id={yt} control={control} start={start} className={className} />
  const src = kind === "youtube" || kind === "vimeo" ? embedSrc(url, kind, start) : null
  if (src) {
    return <iframe key={src} src={src} title="Game video" allow="fullscreen; picture-in-picture" allowFullScreen className={cn("aspect-video w-full rounded-xl border", className)} />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline", className)}>
      <ExternalLink className="size-4" aria-hidden /> Open video
    </a>
  )
}
