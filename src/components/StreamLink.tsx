import { Link2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { isStreamLink } from "@/components/LiveStream"

// Where the person streaming pastes the game's YouTube live link (Share, Copy link in the YouTube app). `onSave` stores it on the game.
export function StreamLink({ current, onSave }: { current?: string; onSave: (url: string) => Promise<boolean> | boolean }) {
  const [open, setOpen] = useState(!current)
  const [value, setValue] = useState(current ?? "")
  const [error, setError] = useState("")
  if (!open)
    return (
      <button type="button" className="self-start text-xs text-muted-foreground underline" onClick={() => setOpen(true)}>
        Change the stream link
      </button>
    )
  const save = async () => {
    const v = value.trim()
    if (!isStreamLink(v)) return setError("Paste the YouTube link for the stream (in YouTube: Share, then Copy link).")
    setError("")
    if (await onSave(v)) setOpen(false)
    else setError("Could not save the link. Try again in a moment.")
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed p-2">
      <p className="text-sm font-medium">Streaming this game? Paste the YouTube live link so everyone can watch and replay.</p>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="url" placeholder="https://youtube.com/live/..." aria-label="YouTube live link" onKeyDown={(e) => e.key === "Enter" && void save()} />
        <Button onClick={() => void save()}>
          <Link2 aria-hidden /> Save
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
