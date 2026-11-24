import { CalendarPlus } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDateLong } from "@/lib/format"
import { seasonDue, startNewSeason, suggestSeasonName } from "@/lib/newSeason"
import type { Update } from "@/lib/store"
import type { PooleanState } from "@/lib/types"

// For the editor, from opening night until the new season is started: one tap closes last season and starts the new one on the opening
// night's date, so opening night's games count toward the new season. Only dates change (newSeason.ts); nothing is deleted.
export function NewSeasonPrompt({ state, update }: { state: PooleanState; update: Update }) {
  const due = seasonDue(state)
  const [name, setName] = useState(() => (due ? suggestSeasonName(state, due) : ""))
  if (!due) return null
  return (
    <section className="flex flex-col gap-2 rounded-xl border-2 border-accent/60 bg-card p-4" aria-label="Start the new season">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <CalendarPlus aria-hidden className="size-5 text-accent" /> Opening night is here. Start the new season?
      </h2>
      <p className="text-sm text-muted-foreground">
        The new season starts {formatDateLong(due)}, so games from that night on count toward it. Last season's games, stats, players and recordings are all kept, and records stay all-time.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name for the season that ended</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
      </label>
      <Button className="self-start" onClick={() => update((s) => startNewSeason(s, due, name))}>
        Start the new season
      </Button>
    </section>
  )
}
