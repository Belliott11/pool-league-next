import { useMemo } from "react"
import { Award } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { milestoneBook, nextUp, type MGame, type MilestoneBook } from "@/lib/milestones"
import { realSeasonsInOrder } from "@/lib/real"
import type { PooleanState } from "@/lib/types"

// Milestones on the Player page's History tab: every mark reached, newest first, and the nearest ones still ahead (src/lib/milestones.ts).

export function bookOf(state: PooleanState): MilestoneBook {
  const old = realSeasonsInOrder().flatMap((s) => s.games)
  return milestoneBook(state.games as unknown as MGame[], old)
}

export function PlayerMilestones({ state, pid }: { state: PooleanState; pid: string }) {
  const book = useMemo(() => bookOf(state), [state])
  const got = [...(book.byPlayer.get(pid) ?? [])].reverse()
  const ahead = nextUp(book, pid)
  if (!got.length && !ahead.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Award aria-hidden className="size-4" /> Milestones
        </CardTitle>
        <p className="text-sm text-muted-foreground">Career marks, win streaks and single-game firsts, from every result on record.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {ahead.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next up</h4>
            {ahead.map((a) => (
              <div key={a.label} className="flex flex-col gap-1">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-muted-foreground tabular-nums">{a.left}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((1 - a.share) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {got.length > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reached ({got.length})</h4>
            <ul className="flex flex-wrap gap-1.5">
              {got.map((m) => (
                <li key={`${m.kind}${m.value}${m.date}`} className="rounded-full border px-2.5 py-1 text-xs">
                  <span className="font-semibold">{m.label}</span> <span className="text-muted-foreground">{formatDateDisplay(m.date)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
