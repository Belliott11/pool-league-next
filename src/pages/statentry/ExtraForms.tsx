import { Clock, Trash2 } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { parseVideoTimeInput } from "@/lib/legacy-core"
import { formatVideoTime } from "@/lib/stats"
import { playerName } from "@/lib/players"
import { addMatchup, addPlay, deleteMatchup, deletePlay, setDirection, timeToInput } from "@/lib/statEntry"
import type { Game, PooleanState } from "@/lib/types"
import { Chip, Field } from "./parts"
import type { Apply } from "./EventForm"

// The rest of what the classic Stat Entry could record: where Team A shoots, defensive matchups, and the
// highlight / lowlight reel. Shots, turnovers, steals and fouls are the buttons above.
export function ExtraEntry({ state, game, apply, now, hasVideo }: { state: PooleanState; game: Game; apply: Apply; now: () => number | null; hasVideo: boolean }) {
  const roster = [...game.teamA, ...game.teamB]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Court side, matchups and clips</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Direction game={game} apply={apply} />
        <Matchups state={state} game={game} roster={roster} apply={apply} now={now} hasVideo={hasVideo} />
        <Clips state={state} game={game} roster={roster} apply={apply} now={now} hasVideo={hasVideo} />
      </CardContent>
    </Card>
  )
}

function Direction({ game, apply }: { game: Game; apply: Apply }) {
  const dir = (game.teamADirection as "left" | "right" | null | undefined) ?? null
  return (
    <Field label="Team A shoots toward" hint="Which side of the screen Team A's hoop is on. It lets the shot-direction stats split left from right.">
      {(["left", "right"] as const).map((d) => (
        <Chip key={d} selected={dir === d} onClick={() => apply((g) => setDirection(g, dir === d ? null : d))}>
          {d === "left" ? "Left" : "Right"}
        </Chip>
      ))}
    </Field>
  )
}

function TimeField({ label, value, onChange, now, hasVideo }: { label: string; value: string; onChange: (v: string) => void; now: () => number | null; hasVideo: boolean }) {
  const bad = value.trim() !== "" && parseVideoTimeInput(value) === null
  return (
    <Field label={label}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" placeholder="m:ss" aria-label={label} aria-invalid={bad} className="h-11 w-28" />
      {hasVideo && (
        <Button type="button" variant="outline" className="h-11 px-3" onClick={() => onChange(timeToInput(now()))}>
          <Clock /> Use video time
        </Button>
      )}
    </Field>
  )
}

function Matchups({ state, game, roster, apply, now, hasVideo }: { state: PooleanState; game: Game; roster: string[]; apply: Apply; now: () => number | null; hasVideo: boolean }) {
  const [defender, setDefender] = useState<string | null>(null)
  const [offender, setOffender] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [time, setTime] = useState("")
  const opponents = defender ? (game.teamA.includes(defender) ? game.teamB : game.teamA) : []
  const t = parseVideoTimeInput(time)
  const ok = !!defender && !!offender && !(time.trim() !== "" && t === null)
  const rows = game.matchups ?? []

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-base font-semibold">Defensive matchups</h3>
      <Field label="Defender">
        {roster.map((id) => (
          <Chip key={id} selected={defender === id} onClick={() => { setDefender(defender === id ? null : id); setOffender(null) }}>
            {playerName(state, id)}
          </Chip>
        ))}
      </Field>
      {defender && (
        <Field label="Guarding">
          {opponents.map((id) => (
            <Chip key={id} selected={offender === id} onClick={() => setOffender(offender === id ? null : id)}>
              {playerName(state, id)}
            </Chip>
          ))}
        </Field>
      )}
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} className="h-11" placeholder="Locked him up, switched, ..." aria-label="Matchup note" />
      </Field>
      <TimeField label="Time" value={time} onChange={setTime} now={now} hasVideo={hasVideo} />
      <Button
        type="button"
        className="h-11 self-start"
        disabled={!ok}
        onClick={() => {
          apply((g) => addMatchup(g, { defenderId: defender!, offenderId: offender!, note: note.trim(), videoTime: t }))
          setOffender(null)
          setNote("")
          setTime("")
        }}
      >
        Add matchup
      </Button>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span>
                {playerName(state, m.defenderId)} guarding {playerName(state, m.offenderId)}
                {m.note ? `: ${m.note}` : ""}
                {m.videoTime !== null && m.videoTime !== undefined ? ` (${formatVideoTime(m.videoTime)})` : ""}
              </span>
              <Button type="button" variant="ghost" size="icon" aria-label="Delete matchup" onClick={() => apply((g) => deleteMatchup(g, m.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Clips({ state, game, roster, apply, now, hasVideo }: { state: PooleanState; game: Game; roster: string[]; apply: Apply; now: () => number | null; hasVideo: boolean }) {
  const [type, setType] = useState<"highlight" | "lowlight">("highlight")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [who, setWho] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const s = parseVideoTimeInput(start)
  const e = parseVideoTimeInput(end)
  const ok = s !== null && e !== null && e > s
  const rows = [...(game.plays ?? [])].sort((a, b) => a.start - b.start)

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-base font-semibold">Highlight and lowlight clips</h3>
      <Field label="Kind">
        <Chip selected={type === "highlight"} onClick={() => setType("highlight")}>Highlight</Chip>
        <Chip selected={type === "lowlight"} onClick={() => setType("lowlight")}>Lowlight</Chip>
      </Field>
      <TimeField label="Clip starts" value={start} onChange={setStart} now={now} hasVideo={hasVideo} />
      <TimeField label="Clip ends" value={end} onChange={setEnd} now={now} hasVideo={hasVideo} />
      {start.trim() !== "" && end.trim() !== "" && !ok && <p className="text-xs text-neg">The end has to be after the start, both as m:ss.</p>}
      <Field label="Player (optional)">
        {roster.map((id) => (
          <Chip key={id} selected={who === id} onClick={() => setWho(who === id ? null : id)}>
            {playerName(state, id)}
          </Chip>
        ))}
      </Field>
      <Field label="Note (optional)">
        <Input value={note} onChange={(ev) => setNote(ev.target.value)} className="h-11" placeholder="Poster dunk, great block, ..." aria-label="Clip note" />
      </Field>
      <Button
        type="button"
        className="h-11 self-start"
        disabled={!ok}
        onClick={() => {
          apply((g) => addPlay(g, { type, start: s!, end: e!, playerId: who, note: note.trim() }))
          setStart("")
          setEnd("")
          setNote("")
        }}
      >
        Add clip
      </Button>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span>
                {p.type === "highlight" ? "Highlight" : "Lowlight"} {formatVideoTime(p.start)} to {formatVideoTime(p.end)}
                {p.playerId ? `, ${playerName(state, p.playerId)}` : ""}
                {p.note ? `: ${p.note}` : ""}
              </span>
              <Button type="button" variant="ghost" size="icon" aria-label="Delete clip" onClick={() => apply((g) => deletePlay(g, p.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
