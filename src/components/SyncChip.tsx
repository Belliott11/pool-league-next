import { Cloud, CloudOff, CloudUpload } from "lucide-react"
import { useEffect, useState } from "react"
import type { Cloud as CloudState } from "@/lib/useCloud"
import { cn } from "@/lib/utils"

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])
  return online
}

// Always-visible save status for the editor, so a score entered with no signal is known to be kept.
export function SyncChip({ cloud }: { cloud: CloudState }) {
  const online = useOnline()
  if (!cloud.admin) return null
  const waiting = cloud.sync === "error" || (!online && cloud.sync === "saving")
  const { label, Icon, tone } = !online
    ? { label: "Offline, kept on this phone", Icon: CloudOff, tone: "text-gold" }
    : cloud.sync === "conflict"
      ? { label: "Needs a look", Icon: CloudOff, tone: "text-neg" }
      : waiting
        ? { label: "Will retry", Icon: CloudUpload, tone: "text-gold" }
        : cloud.sync === "saving"
          ? { label: "Saving", Icon: CloudUpload, tone: "text-muted-foreground" }
          : { label: "Saved", Icon: Cloud, tone: "text-pos" }
  const quiet = online && (cloud.sync === "saved" || cloud.sync === "idle")
  return (
    <span role="status" className={cn("flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium", tone, quiet && "max-sm:hidden")}>
      <Icon aria-hidden className="size-3.5" />
      <span className={cn(quiet && "max-md:sr-only")}>{label}</span>
    </span>
  )
}
