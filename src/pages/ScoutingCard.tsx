import { useMemo, useState } from "react"
import { Panel } from "@/components/Panel"
import { computeLeaderboard } from "@/lib/legacy-core"
import { useReadOnly } from "@/lib/mode"
import { metricsFor, scoutCard, type BoardRow } from "@/lib/scouting"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

type Key = "strengths" | "workOn" | "guard" | "sample"

const HINT =
  "Each player's rates (per 25 combined points) and zone splits set against the league's middle. A stat has to sit clearly away from the middle to be listed. It is a set of notes, not a grade."

// One section's editable note. Saved with the player when the box is left, so typing never rewrites the shared data on every key.
function Note({ value, editable, onSave }: { value: string; editable: boolean; onSave: (v: string) => void }) {
  const [text, setText] = useState(value)
  if (!editable) return value ? <p className="whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-sm">{value}</p> : null
  return (
    <textarea
      aria-label="Notes"
      rows={2}
      value={text}
      placeholder="Your notes"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onSave(text)}
      className="min-h-16 w-full rounded-md border bg-background px-3 py-2 text-sm"
    />
  )
}

export function ScoutingCard({ state, pid, update }: { state: PooleanState; pid: string; update?: Update }) {
  const readOnly = useReadOnly()
  const card = useMemo(() => scoutCard(metricsFor(state, computeLeaderboard() as BoardRow[]), pid), [state, pid])
  const player = state.players.find((p) => p.id === pid)
  if (!card || !player) return null
  const notes = player.scout ?? {}
  const save = (k: Key) => (v: string) =>
    update?.((s) => ({ ...s, players: s.players.map((p) => (p.id === pid ? { ...p, scout: { ...p.scout, [k]: v.trim() || undefined } } : p)) }))
  const block = (k: Key, title: string, body: React.ReactNode) => (
    <section key={k} className="flex flex-col gap-2">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      {body}
      <Note key={`${pid}-${k}`} value={notes[k] ?? ""} editable={!readOnly && !!update} onSave={save(k)} />
    </section>
  )
  const lines = (ls: typeof card.strengths, empty: string) =>
    ls.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="flex flex-col gap-1.5 text-sm">
        {ls.map((l) => (
          <li key={l.label}>
            <span className="font-medium">{l.label}:</span> {l.text}
            <span className="block text-xs text-muted-foreground">{l.vs}</span>
          </li>
        ))}
      </ul>
    )
  return (
    <Panel title="Scouting Card" hint={HINT} tag={card.sample.early ? "Early read" : undefined}>
      {block("strengths", "Strengths", lines(card.strengths, "Nothing sits clearly above the league's middle yet."))}
      {block("workOn", "Work On", lines(card.workOn, "Nothing sits clearly below the league's middle yet."))}
      {block(
        "guard",
        `How to Guard ${player.pronouns === "he" ? "Him" : player.pronouns === "she" ? "Her" : "Them"}`,
        card.guard.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clear shot habit yet.</p>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            {card.guard.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ),
      )}
      {block("sample", "Sample Size", <p className="text-sm">{card.sample.text}</p>)}
    </Panel>
  )
}
