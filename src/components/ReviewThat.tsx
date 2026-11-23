import { Check, Eye } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { haptic } from "@/lib/haptics"
import { NOTE_MAX } from "@/lib/reviews"

// "Review that": during a live game, flags the moment just played for a second look once the recording is up. The time is taken the
// instant it is tapped; a short note (what is in question) can be added after, or skipped. `onFlag` saves it.
export function ReviewThat({ onFlag, count }: { onFlag: (at: number, note?: string) => Promise<boolean> | boolean; count: number }) {
  const [at, setAt] = useState<number | null>(null)
  const [note, setNote] = useState("")
  const [status, setStatus] = useState("")
  const save = async (withNote: boolean) => {
    if (at === null) return
    const ok = await onFlag(at, withNote ? note : undefined)
    setStatus(ok ? "Flagged. It will be ready to watch once the recording is uploaded." : "Could not flag that. Try again in a moment.")
    if (ok) {
      setAt(null)
      setNote("")
      setTimeout(() => setStatus(""), 4000)
    }
  }
  if (at === null)
    return (
      <div className="flex flex-col gap-1">
        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            haptic("tick")
            setAt(Date.now())
            setStatus("")
          }}
        >
          <Eye /> Review that{count > 0 && <span className="text-muted-foreground">({count} flagged)</span>}
        </Button>
        {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
      </div>
    )
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-2">
      <p className="text-sm font-medium">Moment flagged. What is in question? (optional)</p>
      <Input value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} placeholder="Such as: foul on Ben, or did it go in" aria-label="What is in question" onKeyDown={(e) => e.key === "Enter" && void save(true)} autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <Button className="h-11" onClick={() => void save(true)}>
          <Check /> Save
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => void save(false)}>
          Save without a note
        </Button>
      </div>
    </div>
  )
}
