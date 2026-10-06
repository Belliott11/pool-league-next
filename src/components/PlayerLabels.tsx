import { X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LABELS, LABEL_EVENTS, isOwnLine, labelName, ownLine, parseOwnLine, type LabelEvent } from "@/lib/labels"
import { useLabels } from "@/lib/labelsContext"
import { cn } from "@/lib/utils"

const EVENT_HINT = Object.fromEntries(LABEL_EVENTS.map((e) => [e.key, e.vars])) as Record<LabelEvent, string>

// Pick the labels that describe a player. They show up as personal touches in the night recap and injury report.
export function PlayerLabels({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { labels, setPlayerLabels } = useLabels()
  const all = labels[playerId] ?? []
  const mine = all.filter((k) => !isOwnLine(k))
  const lines = all.filter(isOwnLine)
  const [custom, setCustom] = useState("")
  const [event, setEvent] = useState<LabelEvent>("cold")
  const [text, setText] = useState("")
  // Changes read the latest saved labels, so quick successive taps never overwrite each other.
  const change = (fn: (cur: string[]) => string[]) => setPlayerLabels(playerId, fn)
  const toggle = (key: string) => change((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]))
  const customs = mine.filter((k) => !LABELS.some((l) => l.key === k))

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3">
      <p className="text-sm font-medium">Labels</p>
      <p className="text-xs text-muted-foreground">Private to you: friends never see these. Headlines about this player are written around them, and friends only see the finished jokes.</p>
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
      <div className="flex flex-col gap-2 border-t pt-3">
        <p className="text-sm font-medium">Your own lines</p>
        <p className="text-xs text-muted-foreground">Write the joke yourself, like this player's real running gag. It comes up whenever that moment happens. Use {"{n}"} for their name. {EVENT_HINT[event]}</p>
        {lines.map((entry) => {
          const l = parseOwnLine(entry)
          return l ? (
            <div key={entry} className="flex items-start gap-2 rounded-lg border bg-card p-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">{LABEL_EVENTS.find((e) => e.key === l.event)?.label ?? l.event}</span>
                {l.text}
              </span>
              <button type="button" aria-label="Remove this line" className="p-1 text-muted-foreground hover:text-foreground" onClick={() => change((cur) => cur.filter((c) => c !== entry))}>
                <X className="size-3.5" />
              </button>
            </div>
          ) : null
        })}
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const v = text.trim().slice(0, 160)
            if (v) change((cur) => (cur.includes(ownLine(event, v)) ? cur : [...cur, ownLine(event, v)]))
            setText("")
          }}
        >
          <select className="h-10 rounded-md border bg-background px-2 text-sm" value={event} onChange={(e) => setEvent(e.target.value as LabelEvent)} aria-label="When it comes up">
            {LABEL_EVENTS.map((e) => (
              <option key={e.key} value={e.key}>
                {e.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="{n} blamed the rim again" aria-label="The line" />
            <Button type="submit" variant="outline" size="sm" disabled={!text.trim()}>
              Add
            </Button>
          </div>
        </form>
      </div>
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={onClose}>
        Done
      </Button>
    </div>
  )
}
