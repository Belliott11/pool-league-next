import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDateDisplay } from "@/lib/format"
import { VERDICT_LABEL } from "@/lib/gameFlow"
import { currentRules, KIND_LABEL, ruleChanges, type RuleChange } from "@/lib/rulebook"
import { MIN_SIDE_GAMES, ruleImpact, type ImpactRow } from "@/lib/ruleImpact"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

// The rulebook's history (rulebook.ts) and, for a change, the games before against the games after (ruleImpact.ts).

function ChangeLines({ change }: { change: RuleChange }) {
  return (
    <ul className="flex flex-col gap-2">
      {change.diffs.map((d) => (
        <li key={d.section}>
          <div className="font-medium">
            {d.section} <span className="text-xs font-normal text-muted-foreground">({KIND_LABEL[d.kind]})</span>
          </div>
          <ul className="flex flex-col gap-0.5 pl-3">
            {d.removed.map((l) => (
              <li key={`-${l}`} className="text-muted-foreground">
                <span aria-hidden>− </span>
                <span className="sr-only">Removed: </span>
                <span className="line-through">{l}</span>
              </li>
            ))}
            {d.added.map((l) => (
              <li key={`+${l}`}>
                <span aria-hidden className="text-pos">+ </span>
                <span className="sr-only">Added: </span>
                {l}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

// Two sets of games side by side (ruleImpact.ts compareGames): a rulebook change's before and after, or a trial rule's nights against the rest.
export function ImpactRowsTable({ rows, before = "Before", after = "After" }: { rows: ImpactRow[]; before?: string; after?: string }) {
  return (
    <div className="table-scroll overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Measure</TableHead>
            <TableHead className="text-right">{before}</TableHead>
            <TableHead className="text-right">{after}</TableHead>
            <TableHead className="hidden sm:table-cell">Change</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell className="min-w-32 whitespace-normal">
                {r.label}
                <span className="block text-xs text-muted-foreground">{r.group}</span>
                <span className={cn("block text-xs sm:hidden", r.verdict === "clear" ? "font-semibold" : r.verdict === "early" ? "italic text-muted-foreground" : "")}>
                  {r.change}: {VERDICT_LABEL[r.verdict].toLowerCase()}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.before}</TableCell>
              <TableCell className="text-right tabular-nums">{r.after}</TableCell>
              <TableCell className="hidden min-w-28 whitespace-normal sm:table-cell">
                {r.change}
                <span className={cn("block text-xs", r.verdict === "clear" ? "font-semibold" : r.verdict === "early" ? "italic text-muted-foreground" : "")}>{VERDICT_LABEL[r.verdict]}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function ImpactTable({ state, change }: { state: PooleanState; change: RuleChange }) {
  const impact = useMemo(() => ruleImpact(state, change), [state, change])
  if (!impact) return null
  if (!impact.rows.length)
    return (
      <p className="text-muted-foreground">
        Before and after needs {MIN_SIDE_GAMES} filmed games on each side; so far {impact.before} before and {impact.after} after.
      </p>
    )
  return (
    <div>
      <p className="mb-2">
        {impact.before} filmed games under the old rules against {impact.after} since {formatDateDisplay(change.version.from!)}.
      </p>
      <ImpactRowsTable rows={impact.rows} />
      <p className="mt-1 text-xs text-muted-foreground">Counts are per 10 trips (turns with the ball), so longer games do not look rougher. Each change says how sure it is.</p>
    </div>
  )
}

// For the How page: every change, newest first, with what it did; or, before any change, the rules as tracked.
export function RuleHistory({ state }: { state: PooleanState }) {
  const changes = useMemo(() => [...ruleChanges()].reverse(), [])
  const [pick, setPick] = useState(0)
  const now = currentRules()
  if (!changes.length)
    return (
      <>
        <p>
          The rulebook has not changed since tracking began. The site reads it from Poolean every hour, so when a rule is added or reworded, the change shows up here with its date, and
          every game is matched to the rules it was played under.
        </p>
        <p>
          When it changes, this section compares the games before and after: fouls, roughness free throws, steals, turnovers, how hard shots are contested, how often defenders get
          beaten, and what that does to scoring. The Filters menu also gets a switch to count only games under the new rules.
        </p>
        {now && (
          <details>
            <summary className="cursor-pointer font-medium">The rules as they stand ({now.sections.length} sections)</summary>
            <ol className="mt-2 flex flex-col gap-2">
              {now.sections.map((s) => (
                <li key={s.n}>
                  <div className="font-medium">
                    {s.n}. {s.title}
                  </div>
                  <ul className="list-disc pl-5">
                    {s.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                    {s.subs.map((sub) => (
                      <li key={sub.title}>
                        {sub.title}: {sub.lines.join(" ")}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </details>
        )}
      </>
    )
  const c = changes[pick]
  return (
    <>
      {changes.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Change</span>
          <select className="rounded-md border bg-background px-2 py-1" value={pick} onChange={(e) => setPick(Number(e.target.value))}>
            {changes.map((x, i) => (
              <option key={x.version.hash} value={i}>
                {formatDateDisplay(x.version.from!)}: {x.kinds.map((k) => KIND_LABEL[k]).join(", ")}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        <div className="mb-1 font-semibold">What changed on {formatDateDisplay(c.version.from!)}</div>
        <ChangeLines change={c} />
      </div>
      <div>
        <div className="mb-1 font-semibold">Did it change the game?</div>
        <ImpactTable state={state} change={c} />
      </div>
    </>
  )
}

// For the Leaderboard's Trends tab, once the rulebook has changed.
export function RuleChangeCard({ state }: { state: PooleanState }) {
  const c = ruleChanges().at(-1)
  if (!c) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Did the rule change work?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Poolean's rulebook changed on {formatDateDisplay(c.version.from!)} ({c.kinds.map((k) => KIND_LABEL[k].toLowerCase()).join(", ")}). The games before against the games after.{" "}
          <a className="underline underline-offset-2" href="#/games/how">
            What changed
          </a>
        </p>
      </CardHeader>
      <CardContent className="text-sm">
        <ImpactTable state={state} change={c} />
      </CardContent>
    </Card>
  )
}
