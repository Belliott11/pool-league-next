import { useMemo, useState } from "react"
import { FlaskConical, Trash2, X } from "lucide-react"
import { ImpactRowsTable } from "@/components/RuleChanges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDateDisplay, uid } from "@/lib/format"
import { MIN_SIDE_GAMES } from "@/lib/ruleImpact"
import { trialResult } from "@/lib/ruleTrials"
import type { Update } from "@/lib/store"
import type { PooleanState, RuleTrial } from "@/lib/types"

// Trial rules on the Rules page (ruleTrials.ts): each trial, its nights, and what changed against nights under no trial. The editor
// starts one, adds or takes off nights, and deletes it.

const today = () => new Date().toLocaleDateString("en-CA")
const setTrials = (update: Update, f: (ts: RuleTrial[]) => RuleTrial[]) => update((s) => ({ ...s, ruleTrials: f(s.ruleTrials ?? []) }))

function Trial({ state, trial, update }: { state: PooleanState; trial: RuleTrial; update?: Update }) {
  const r = useMemo(() => trialResult(state, trial), [state, trial])
  const [night, setNight] = useState(today())
  return (
    <section aria-label={trial.name} className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{trial.name}</h3>
          {trial.detail && <p className="text-muted-foreground">{trial.detail}</p>}
        </div>
        {update && (
          <button type="button" aria-label={`Delete the trial ${trial.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => confirm(`Delete the trial "${trial.name}"? The games stay; only the trial goes.`) && setTrials(update, (ts) => ts.filter((t) => t.id !== trial.id))}>
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">Nights:</span>
        {trial.dates.length === 0 && <span className="italic text-muted-foreground">none yet</span>}
        {[...trial.dates].sort().map((d) => (
          <span key={d} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
            {formatDateDisplay(d)}
            {update && (
              <button type="button" aria-label={`Take ${formatDateDisplay(d)} off this trial`} onClick={() => setTrials(update, (ts) => ts.map((t) => (t.id === trial.id ? { ...t, dates: t.dates.filter((x) => x !== d) } : t)))}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {update && (
        <div className="flex items-center gap-2 text-sm">
          <Input type="date" value={night} onChange={(e) => setNight(e.target.value)} className="h-9 w-40" aria-label="A night played under this trial" />
          <Button size="sm" variant="outline" disabled={!night || trial.dates.includes(night) || (state.ruleTrials ?? []).some((t) => t.id !== trial.id && t.dates.includes(night))} onClick={() => setTrials(update, (ts) => ts.map((t) => (t.id === trial.id ? { ...t, dates: [...t.dates, night] } : t)))}>
            Add this night
          </Button>
        </div>
      )}
      {r.rows.length ? (
        <>
          <p>
            {r.trialGames} filmed games under the trial against {r.otherGames} under the usual rules.
          </p>
          <ImpactRowsTable rows={r.rows} before="Usual" after="Trial" />
        </>
      ) : (
        <p className="text-muted-foreground">
          The comparison needs {MIN_SIDE_GAMES} filmed games under the trial; so far {r.trialGames}. Film the trial nights so it can tell what changed.
        </p>
      )}
    </section>
  )
}

export function RuleTrials({ state, update }: { state: PooleanState; update?: Update }) {
  const trials = state.ruleTrials ?? []
  const [name, setName] = useState("")
  const [detail, setDetail] = useState("")
  const [first, setFirst] = useState(today())
  if (!trials.length && !update) return null
  const start = () => {
    if (!update || !name.trim()) return
    setTrials(update, (ts) => [...ts, { id: uid("trial"), name: name.trim(), detail: detail.trim(), dates: first ? [first] : [] }])
    setName("")
    setDetail("")
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical aria-hidden className="size-4 text-accent" /> Trial rules
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">Try a rule for a night or two, then see what it did against nights under the usual rules, before asking Adam to make it official.</p>
        {trials.map((t) => (
          <Trial key={t.id} state={state} trial={t} update={update} />
        ))}
        {update && (
          <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
            <p className="font-medium">Start a trial</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, such as 3-point line moved in" aria-label="Trial name" maxLength={60} />
            <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What changes, such as the line at half the pool's length" aria-label="What the trial changes" maxLength={200} />
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground">First night</span>
              <Input type="date" value={first} onChange={(e) => setFirst(e.target.value)} className="h-9 w-40" />
            </label>
            <Button className="self-start" disabled={!name.trim()} onClick={start}>
              Start the trial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
