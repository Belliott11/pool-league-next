import type { Ref } from "react"
import { ExternalLink } from "lucide-react"
import { EmptyState } from "@/components/EmptyState"
import { embedKind } from "@/lib/video"
import { cn } from "@/lib/utils"

function embedSrc(url: string, kind: "youtube" | "vimeo"): string | null {
  try {
    const u = new URL(url)
    if (kind === "vimeo") {
      const id = u.pathname.split("/").filter(Boolean).pop()
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null
    }
    const id = u.hostname.includes("youtu.be")
      ? u.pathname.slice(1)
      : u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch {
    return null
  }
}

export function GameVideo({ url, videoRef, className, onTimeUpdate }: { url?: string | null; videoRef?: Ref<HTMLVideoElement>; className?: string; onTimeUpdate?: (t: number) => void }) {
  if (!url) return <EmptyState className={className} title="No video yet" hint="Add a video to this game to watch it here." />
  const kind = embedKind(url)
  if (kind === "file") {
    return (
      <video
        ref={videoRef}
        src={url}
        controls
        playsInline
        preload="metadata"
        className={cn("aspect-video w-full rounded-xl bg-muted", className)}
        onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
      />
    )
  }
  // Timestamps cannot be read from an iframe (cross-origin), so clip tie-ins only work for file videos.
  const src = kind === "youtube" || kind === "vimeo" ? embedSrc(url, kind) : null
  if (src) {
    return <iframe src={src} title="Game video" allow="fullscreen; picture-in-picture" allowFullScreen className={cn("aspect-video w-full rounded-xl border", className)} />
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline", className)}>
      <ExternalLink className="size-4" aria-hidden /> Open video
    </a>
  )
}
