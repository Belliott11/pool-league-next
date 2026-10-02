import { ArrowDownUp, Clock, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/EmptyState"
import { CONTEST_LEVELS, SHOT_TYPES, TURNOVER_TYPES, sameTeam } from "@/lib/legacy-core"
import { playerName } from "@/lib/players"
import { formatVideoTime } from "@/lib/stats"
import type { EventRef, TagKind } from "@/lib/statEntry"
import type { Game, PooleanState, ScoringEvent, TurnoverEvent } from "@/lib/types"
import type { Edit } from "./EventForm"

interface Props {
  state: PooleanState
  game: Game
  canSeek: boolean
  onSeek: (t: number) => void
  onEdit: (e: Edit) => void
  onDelete: (r: EventRef) => void
}

type Row = { ref: EventRef; edit: Edit; time: number | null; order: number }

function TimeButton({ t, canSeek, onSeek }: { t: number | null | undefined; canSeek: boolean; onSeek: (t: number) => void }) {
  const label = formatVideoTime(t)
  if (t === null || t === undefined || !canSeek) return <span className="w-14 shrink-0 text-sm tabular-nums text-muted-foreground">{label}</span>
  return (
    <button type="button" onClick={() => onSeek(t)} aria-label={`Seek video to ${label}`} className="flex min-h-11 w-16 shrink-0 items-center gap-1 text-sm tabular-nums text-primary">
      <Clock className="size-3.5" />
      {label}
    </button>
  )
}

function RowActions({ onEdit, onDelete, what }: { onEdit: () => void; onDelete: () => void; what: string }) {
  return (
    <div className="flex shrink-0">
      <Button type="button" variant="ghost" className="size-11" aria-label={`Edit ${what}`} onClick={onEdit}>
        <Pencil />
      </Button>
      <Button type="button" variant="ghost" className="size-11 text-neg" aria-label={`Delete ${what}`} onClick={onDelete}>
        <Trash2 />
      </Button>
    </div>
  )
}

// Chronological = by video time (events with no time last), else the order they were logged.
function order(rows: Row[], newestFirst: boolean, byTime: boolean) {
  const r = [...rows]
  if (byTime) r.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity))
  else r.sort((a, b) => a.order - b.order)
  return newestFirst ? r.reverse() : r
}

export function EventLog({ state, game, canSeek, onSeek, onEdit, onDelete }: Props) {
  const [tab, setTab] = useState<"shots" | "other">("shots")
  const [newestFirst, setNewestFirst] = useState(true)
  const [byTime, setByTime] = useState(false)
  const nm = (id?: string | null) => (id ? playerName(state, id) : "")

  const shotRows: Row[] = game.scoringEvents.map((ev, i) => ({ ref: { kind: "shot", id: ev.id }, edit: { kind: "shot", ev }, time: ev.videoTime ?? null, order: i }))
  const otherRows: Row[] = [
    ...game.turnoverEvents.map((ev, i) => ({ ref: { kind: "tov" as TagKind, id: ev.id }, edit: { kind: "tov" as TagKind, ev }, time: ev.videoTime ?? null, order: i })),
    ...game.stealEvents.map((ev, i) => ({ ref: { kind: "stl" as TagKind, id: ev.id }, edit: { kind: "stl" as TagKind, ev: ev as TurnoverEvent }, time: ev.videoTime ?? null, order: 1000 + i })),
    ...game.foulEvents.map((ev, i) => ({ ref: { kind: "pf" as TagKind, id: ev.id }, edit: { kind: "pf" as TagKind, ev: ev as TurnoverEvent }, time: ev.videoTime ?? null, order: 2000 + i })),
  ]
  const rows = order(tab === "shots" ? shotRows : otherRows, newestFirst, byTime)

  const shotText = (ev: ScoringEvent) => {
    const made = ev.made !== false
    const bits: string[] = []
    if (ev.defenderIds?.length) bits.push(`vs ${ev.defenderIds.map(nm).join(" + ")}`)
    const lvl = ev.contestLevel && ev.contestLevel !== "none" ? CONTEST_LEVELS.find((c: { key: string }) => c.key === ev.contestLevel)?.label : null
    if (lvl) bits.push(lvl)
    const type = ev.dunk ? "Dunk" : SHOT_TYPES.find((t: { key: string }) => t.key === ev.shotType)?.label
    if (type) bits.push(type)
    if (made && ev.assistId) bits.push(`assist ${nm(ev.assistId)}`)
    if (!made && ev.blockerId) bits.push(`blocked by ${nm(ev.blockerId)}`)
    if (!made && ev.rebounderId) bits.push(`${sameTeam(game, ev.scorerId, ev.rebounderId) ? "OREB" : "DREB"} ${nm(ev.rebounderId)}`)
    if (ev.turnoverEventId) bits.push("out of bounds, turnover")
    if (ev.shotLocation) bits.push("located")
    return { made, text: bits.join(", ") }
  }

  const otherText = (r: Row) => {
    const ev = r.edit.ev as TurnoverEvent
    const k = r.edit.kind
    if (k === "tov") {
      const type = TURNOVER_TYPES.find((t: { key: string }) => t.key === ev.turnoverType)?.label
      const via = ev.stealEventId ? "via steal" : ev.missEventId ? "shot out of bounds" : ""
      return { label: "Turnover", who: nm(ev.playerId), detail: [type, ev.opponentId ? `forced by ${nm(ev.opponentId)}` : "", via].filter(Boolean).join(", ") }
    }
    if (k === "stl") return { label: "Steal", who: nm(ev.playerId), detail: `from ${nm(ev.opponentId)}` }
    return { label: "Foul", who: nm(ev.playerId), detail: ev.opponentId ? `on ${nm(ev.opponentId)}` : "" }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Event log</CardTitle>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant={tab === "shots" ? "default" : "outline"} className="h-11 px-3" aria-pressed={tab === "shots"} onClick={() => setTab("shots")}>
            Shots ({game.scoringEvents.length})
          </Button>
          <Button type="button" variant={tab === "other" ? "default" : "outline"} className="h-11 px-3" aria-pressed={tab === "other"} onClick={() => setTab("other")}>
            TOV / STL / PF ({otherRows.length})
          </Button>
          <Button type="button" variant="ghost" className="h-11 px-3" onClick={() => setNewestFirst(!newestFirst)}>
            <ArrowDownUp /> {newestFirst ? "Newest first" : "Oldest first"}
          </Button>
          <Button type="button" variant="ghost" className="h-11 px-3" aria-pressed={byTime} onClick={() => setByTime(!byTime)}>
            {byTime ? "By video time" : "By entry order"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState title={tab === "shots" ? "No shots logged yet" : "No turnovers, steals or fouls yet"} hint="Use the Add buttons above." />
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              if (r.edit.kind === "shot") {
                const ev = r.edit.ev
                const { made, text } = shotText(ev)
                const who = nm(ev.scorerId)
                return (
                  <li key={ev.id} className="flex items-center gap-1 py-1">
                    <TimeButton t={ev.videoTime} canSeek={canSeek} onSeek={onSeek} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {who}
                        <Badge className={made ? "bg-pos text-primary-foreground" : "bg-neg text-primary-foreground"}>
                          {made ? "Make" : "Miss"} {ev.points === 1 ? "FT" : ev.points}
                        </Badge>
                      </p>
                      {text && <p className="text-xs text-muted-foreground">{text}</p>}
                    </div>
                    <RowActions what={`${who} shot`} onEdit={() => onEdit(r.edit)} onDelete={() => onDelete(r.ref)} />
                  </li>
                )
              }
              const o = otherText(r)
              return (
                <li key={r.ref.kind + r.ref.id} className="flex items-center gap-1 py-1">
                  <TimeButton t={r.time} canSeek={canSeek} onSeek={onSeek} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {o.who}
                      <Badge variant="secondary">{o.label}</Badge>
                    </p>
                    {o.detail && <p className="text-xs text-muted-foreground">{o.detail}</p>}
                  </div>
                  <RowActions what={`${o.who} ${o.label.toLowerCase()}`} onEdit={() => onEdit(r.edit)} onDelete={() => onDelete(r.ref)} />
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
