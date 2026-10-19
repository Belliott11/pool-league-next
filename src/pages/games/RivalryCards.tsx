import { CalendarCheck, Swords } from "lucide-react"
import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { attendance, RECENT, REGULAR_PCT } from "@/lib/attendance"
import { formatDateDisplay } from "@/lib/format"
import { playerName } from "@/lib/players"
import { rivalries } from "@/lib/rivalries"
import type { PooleanState } from "@/lib/types"

// Pairs who keep meeting, closest and most-played first.
export function RivalriesCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => rivalries(state), [state])
  if (rows.length === 0) return null
  const name = (id: string) => (
    <button type="button" className="font-medium hover:underline" onClick={() => onOpenPlayer(id)}>
      {playerName(state, id)}
    </button>
  )
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Swords aria-hidden className="size-4 text-accent" /> Rivalries
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className="text-xs text-muted-foreground">Pairs who have faced each other at least 4 times, closest records first.</p>
        {rows.map((r) => (
          <p key={r.a + r.b}>
            {name(r.a)} {r.aWins === r.bWins ? "and" : "leads"} {name(r.b)} <span className="tabular-nums">{r.aWins}-{r.bWins}</span>.{" "}
            {r.streak >= 2 ? <>{playerName(state, r.streakBy!)} has won the last {r.streak}. </> : null}
            <span className="text-muted-foreground">Last met {formatDateDisplay(r.last)}.</span>
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

// Who shows up: share of all nights, and how many of the last few.
export function AttendanceCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const { total, rows } = useMemo(() => attendance(state), [state])
  if (total < 4 || rows.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <CalendarCheck aria-hidden className="size-4 text-accent" /> Attendance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">
          Out of {total} nights. Regulars are at {REGULAR_PCT}% or more. The last number is the last {Math.min(RECENT, total)} nights.
        </p>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-sm">
            <button type="button" className="w-24 truncate text-left hover:underline" onClick={() => onOpenPlayer(r.id)}>
              {playerName(state, r.id)}
            </button>
            <div role="img" aria-label={`${r.pct} percent of nights`} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="anim-bar block h-full bg-pos" style={{ width: `${r.pct}%` }} />
            </div>
            <span className="w-10 text-right tabular-nums">{r.pct}%</span>
            <span className="w-8 text-right tabular-nums text-muted-foreground">{r.recent}/{Math.min(RECENT, total)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
