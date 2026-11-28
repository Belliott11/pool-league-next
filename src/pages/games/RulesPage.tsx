import { useMemo, useState } from "react"
import { ArrowLeft, Lightbulb, Send, Trash2 } from "lucide-react"
import { RulesLookup } from "@/components/RulesLookup"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay, uid } from "@/lib/format"
import { useReadOnly } from "@/lib/mode"
import { currentRules } from "@/lib/rulebook"
import { ruleGaps, ruleIdeas, rulesForAdam } from "@/lib/ruleIdeas"
import { shareText } from "@/lib/shareText"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

// The Rules page at #/games/rules: search, the questions the rulebook leaves open and ideas from the numbers (ruleIdeas.ts), then the whole
// rulebook with the league's own clarifications under each section (state.ruleNotes; the editor adds and removes them here). The rulebook
// itself is Poolean's (Adam's app), copied hourly by scripts/rulebook.mjs, so a change to the rules is made there.

function AddNote({ section, update, gap, label = "Add a clarification", placeholder }: { section: string; update: Update; gap?: string; label?: string; placeholder?: string }) {
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button type="button" className="self-start text-xs font-medium text-accent hover:underline" onClick={() => setOpen(true)}>
        {label}
      </button>
    )
  const save = () => {
    const t = text.trim()
    if (!t) return
    update((s) => ({ ...s, ruleNotes: [...(s.ruleNotes ?? []), { id: uid("rn"), section, text: t, date: new Date().toLocaleDateString("en-CA"), ...(gap ? { gap } : {}) }] }))
    setText("")
    setOpen(false)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} rows={2} className="rounded-md border bg-background p-2 text-sm" placeholder={placeholder ?? `How the league reads ${section.toLowerCase()}, such as a ruling from a game`} aria-label={`Clarification for ${section}`} />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={!text.trim()}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export function RulesPage({ state, update, onBack }: { state: PooleanState; update?: Update; onBack: () => void }) {
  const editor = !useReadOnly() && !!update
  const rules = currentRules()
  const gaps = useMemo(() => ruleGaps(state), [state])
  const ideas = useMemo(() => ruleIdeas(state), [state])
  const notes = state.ruleNotes ?? []
  const [sent, setSent] = useState("")
  const forAdam = rulesForAdam(state)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft />
        </Button>
        <h2 className="font-display text-2xl font-bold">Rules</h2>
      </div>
      <RulesLookup state={state} />

      {(gaps.length > 0 || ideas.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb aria-hidden className="size-4 text-gold" /> Make the rules better
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <p className="text-muted-foreground">Things to talk over as a group. Nothing here changes a rule: the rulebook lives in Poolean, Adam's app.</p>
            {gaps.length > 0 && (
              <section aria-label="Not in the rulebook yet" className="flex flex-col gap-2">
                <h3 className="font-semibold">Not in the rulebook yet</h3>
                <ul className="flex flex-col gap-2">
                  {gaps.map((g) => (
                    <li key={g.key} className="flex flex-col rounded-lg border border-dashed p-2">
                      <span className="font-medium">{g.topic}</span>
                      <span>{g.ask}</span>
                      {g.why && <span className="text-xs text-muted-foreground">{g.why}</span>}
                      {editor && <div className="mt-1"><AddNote section={g.section} update={update!} gap={g.key} label="Answer it" placeholder={`The league's answer. It is filed under ${g.section}.`} /></div>}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground">Each one drops off this list once the rulebook answers it{editor ? ", or once you answer it here (filed as a league clarification under its section)" : ""}.</p>
              </section>
            )}
            {ideas.length > 0 && (
              <section aria-label="What the games say" className="flex flex-col gap-2">
                <h3 className="font-semibold">What the games say</h3>
                <ul className="flex flex-col gap-2">
                  {ideas.map((i) => (
                    <li key={i.key} className="flex flex-col gap-0.5 rounded-lg border p-2">
                      <span className="font-medium">{i.title}</span>
                      <span className="text-muted-foreground">{i.fact}</span>
                      <span>{i.idea}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      {editor && forAdam && (
        <div className="flex flex-col gap-1.5 rounded-xl border p-3 text-sm">
          <p>
            {notes.length} league {notes.length === 1 ? "clarification" : "clarifications"} so far. The official rulebook only changes in Adam's Poolean app, so send them to him to
            add there. Once he publishes, the site picks up the new rulebook within the hour, and any open question it answers leaves the list.
          </p>
          <Button
            variant="outline"
            className="self-start"
            onClick={async () => {
              setSent(await shareText(forAdam))
              setTimeout(() => setSent(""), 2500)
            }}
          >
            <Send aria-hidden /> {sent === "copied" ? "Copied: paste it to Adam" : sent === "failed" ? "Could not share" : sent === "shared" ? "Sent" : "Send these to Adam"}
          </Button>
        </div>
      )}

      {rules && (
        <Card>
          <CardHeader>
            <CardTitle>The rulebook</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            {rules.from && <p className="text-xs text-muted-foreground">This version since {formatDateDisplay(rules.from)}.</p>}
            {rules.sections.map((s) => {
              const mine = notes.filter((n) => n.section === s.title)
              return (
                <section key={s.n} aria-label={s.title} className="flex flex-col gap-1.5">
                  <h3 className="font-semibold">
                    {s.n}. {s.title}
                  </h3>
                  {s.lines.length > 0 && (
                    <ul className="flex list-disc flex-col gap-0.5 pl-5">
                      {s.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  )}
                  {s.subs.map((sub) => (
                    <div key={sub.title} className="flex flex-col gap-0.5">
                      <p className="font-medium">{sub.title}</p>
                      <ul className="flex list-disc flex-col gap-0.5 pl-5">
                        {sub.lines.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {mine.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {mine.map((n) => (
                        <li key={n.id} className="flex items-start gap-2 rounded-md bg-muted p-2">
                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-medium text-muted-foreground">League clarification, {formatDateDisplay(n.date)}: </span>
                            <span className="italic">{n.text}</span>
                          </span>
                          {editor && (
                            <button type="button" aria-label="Remove this clarification" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => update!((st) => ({ ...st, ruleNotes: (st.ruleNotes ?? []).filter((x) => x.id !== n.id) }))}>
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {editor && <AddNote section={s.title} update={update!} />}
                </section>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
