import { Dices, HeartPulse, Pencil, X } from "lucide-react"
import { useState } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDateDisplay, uid } from "@/lib/format"
import { INJURY_STATUSES, goofyNote, injuryBoard, statusInfo } from "@/lib/injuries"
import { useReadOnly } from "@/lib/mode"
import type { Update } from "@/lib/store"
import type { Injury, InjuryStatus, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

const TONE = {
  neg: "bg-neg/15 text-neg",
  gold: "bg-gold/15 text-gold",
  muted: "bg-muted text-muted-foreground",
  pos: "bg-pos/15 text-pos",
} as const

// A news-ticker style board for who is out or away. Anyone can read it; only the editor changes it.
export function InjuryBoard({ state, update, onOpenPlayer }: { state: PooleanState; update: Update; onOpenPlayer: (id: string) => void }) {
  const readOnly = useReadOnly()
  const board = injuryBoard(state)
  const [editing, setEditing] = useState<Injury | "new" | null>(null)

  const save = (inj: Injury) => {
    update((s) => {
      const rest = (s.injuries ?? []).filter((i) => i.id !== inj.id)
      return { ...s, injuries: [...rest, inj] }
    })
    setEditing(null)
  }
  const clear = (id: string) => update((s) => ({ ...s, injuries: (s.injuries ?? []).filter((i) => i.id !== id) }))

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 font-display">
          <HeartPulse aria-hidden className="size-4 text-neg" /> Injury report
        </CardTitle>
        {!readOnly && editing === null && (
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!readOnly && editing !== null && <Form state={state} initial={editing === "new" ? null : editing} onSave={save} onCancel={() => setEditing(null)} />}
        {board.length === 0 && editing === null && <p className="text-sm text-muted-foreground">Everyone is healthy. Suspiciously.</p>}
        <ul className="flex flex-col gap-3">
          {board.map((i) => {
            const name = state.players.find((p) => p.id === i.playerId)?.name ?? "Someone"
            const info = statusInfo(i.status)
            return (
              <li key={i.id} className="flex gap-3">
                <PlayerAvatar id={i.playerId} name={name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="font-semibold hover:underline" onClick={() => onOpenPlayer(i.playerId)}>
                      {name}
                    </button>
                    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide", TONE[info.tone])}>{info.label}</span>
                  </div>
                  {i.note && <p className="text-sm">{i.note}</p>}
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDateDisplay(i.updatedAt.slice(0, 10))}
                    {i.until ? `, expected back ${formatDateDisplay(i.until)}` : ""}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Edit ${name}`} onClick={() => setEditing(i)}>
                      <Pencil />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-8" aria-label={`Clear ${name} to play`} title="Cleared to play" onClick={() => clear(i.id)}>
                      <X />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function Form({ state, initial, onSave, onCancel }: { state: PooleanState; initial: Injury | null; onSave: (i: Injury) => void; onCancel: () => void }) {
  const onBoard = new Set((state.injuries ?? []).map((i) => i.playerId))
  const choices = [...state.players].filter((p) => p.id === initial?.playerId || !onBoard.has(p.id)).sort((a, b) => a.name.localeCompare(b.name))
  const [playerId, setPlayerId] = useState(initial?.playerId ?? "")
  const [status, setStatus] = useState<InjuryStatus>(initial?.status ?? "out")
  const [note, setNote] = useState(initial?.note ?? "")
  const [until, setUntil] = useState(initial?.until ?? "")

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!playerId) return
        onSave({ id: initial?.id ?? uid("injury"), playerId, status, note: note.trim(), until: until || null, updatedAt: new Date().toISOString() })
      }}
    >
      <select className="h-10 rounded-md border bg-background px-2 text-sm" value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={!!initial} aria-label="Who">
        <option value="">Who is it?</option>
        {choices.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Status">
        {INJURY_STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={status === s.key}
            onClick={() => setStatus(s.key)}
            className={cn("min-h-9 rounded-lg border px-2.5 text-xs font-bold tracking-wide", status === s.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="The details, as silly as you like" aria-label="Note" />
        <Button type="button" variant="outline" size="icon" aria-label="Surprise me with a note" title="Surprise me" onClick={() => setNote(goofyNote(status, note))}>
          <Dices />
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Expected back
        <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-9 w-40" aria-label="Expected back" />
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!playerId}>
          Post
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
