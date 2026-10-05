import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LABELS, labelName, labelsOf } from "@/lib/labels"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Pick the labels that describe a player. They show up as personal touches in the night recap and injury report.
export function PlayerLabels({ state, playerId, update, onClose }: { state: PooleanState; playerId: string; update: Update; onClose: () => void }) {
  const mine = labelsOf(state, playerId)
  const [custom, setCustom] = useState("")
  // Changes read the latest saved labels, so quick successive taps never overwrite each other.
  const change = (fn: (cur: string[]) => string[]) =>
    update((s) => {
      const book = { ...(s.playerLabels ?? {}) }
      const next = fn(book[playerId] ?? [])
      if (next.length) book[playerId] = next
      else delete book[playerId]
      return { ...s, playerLabels: book }
    })
  const toggle = (key: string) => change((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  const customs = mine.filter((k) => !LABELS.some((l) => l.key === k))

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <p className="text-sm font-medium">Labels</p>
      <p className="text-xs text-muted-foreground">Pick what fits. Headlines about this player get written around them, so choose the ones you want roasted.</p>
      <div className="flex flex-wrap gap-1.5">
        {LABELS.map((l) => (
          <button
            key={l.key}
            type="button"
            title={l.blurb}
            aria-pressed={mine.includes(l.key)}
            onClick={() => toggle(l.key)}
            className={cn("min-h-9 rounded-lg border px-2.5 text-xs font-medium", mine.includes(l.key) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted")}
          >
            {l.name}
          </button>
        ))}
      </div>
      {customs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customs.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 rounded-lg border border-primary bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground">
              {labelName(k)}
              <button type="button" aria-label={`Remove ${k}`} onClick={() => toggle(k)}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const v = custom.trim().slice(0, 24)
          if (v) change((cur) => (cur.includes(v) ? cur : [...cur, v]))
          setCustom("")
        }}
      >
        <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or type your own, like Sunday Hero" aria-label="Custom label" />
        <Button type="submit" variant="outline" size="sm" disabled={!custom.trim()}>
          Add
        </Button>
      </form>
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}
