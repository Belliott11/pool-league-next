import { useMemo, useState } from "react"
import { BookOpen, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { searchRules, type RuleLine } from "@/lib/rulesLookup"
import type { PooleanState } from "@/lib/types"

// Search Poolean's rules (rulesLookup.ts): the compact box on both live screens, and the top of the Rules page.
export function RuleResult({ l }: { l: RuleLine }) {
  return (
    <li className="flex flex-col rounded-lg border p-2">
      <span className="text-xs text-muted-foreground">
        {l.n}. {l.section}
        {l.sub ? `, ${l.sub}` : ""}
        {l.note ? ", the league's clarification" : ""}
      </span>
      <span className={l.note ? "italic" : ""}>{l.text}</span>
    </li>
  )
}

export function RulesLookup({ state, compact = false, onAll }: { state: PooleanState; compact?: boolean; onAll?: () => void }) {
  const [q, setQ] = useState("")
  const hits = useMemo(() => searchRules(q, state.ruleNotes ?? [], compact ? 3 : 8), [q, state.ruleNotes, compact])
  return (
    <div className="flex flex-col gap-2">
      <label className="relative block">
        <span className="sr-only">Look up a rule</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={compact ? "Look up a rule: out of bounds, hug, goaltend" : "What happened? Out of bounds off the coping, a hug, a foul on a 3"} className="h-11 pl-9" />
      </label>
      {q.trim() && (
        <ul className="flex flex-col gap-1.5 text-sm" aria-live="polite">
          {hits.length ? hits.map((l, i) => <RuleResult key={i} l={l} />) : <li className="text-muted-foreground">Nothing in the rulebook matches. Common sense and good sportsmanship cover anything the rules don't.</li>}
        </ul>
      )}
      {compact && onAll && (
        <button type="button" onClick={onAll} className="flex items-center gap-1.5 self-start text-xs font-medium text-accent hover:underline">
          <BookOpen aria-hidden className="size-3.5" /> All the rules
        </button>
      )}
    </div>
  )
}
