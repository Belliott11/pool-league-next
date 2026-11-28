import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { signed } from "@/lib/format"
import { nightGrades } from "@/lib/nightReport"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Every player's grade for one filmed night (nightGrades in nightReport.ts), on the night recap. Each is against that player's own level,
// so the list is who had a good night for them, not who is best. A tap opens the player's page.
export function NightGrades({ state, date, onOpenPlayer }: { state: PooleanState; date: string; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => nightGrades(state, date), [state, date])
  if (!rows.length) return null
  return (
    <section className="flex flex-col gap-1.5" aria-label="Night grades">
      <h3 className="font-display text-lg font-bold">Night grades</h3>
      <p className="text-xs text-muted-foreground">Each player against their own usual level, half on Points added and half on Two-Way a game, so an A is a great night for them, not a ranking. A first filmed night has no grade yet.</p>
      <div className="table-scroll overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Grade</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Record</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Pts</TableHead>
              <TableHead className="text-right">Points added</TableHead>
              <TableHead className="text-right">Two-Way</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.pid}>
                <TableCell>
                  <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.pid)}>
                    {playerName(state, r.pid)}
                  </button>
                  <span className="block text-xs text-muted-foreground sm:hidden">
                    {r.wins}-{r.losses}, {r.points} pts
                  </span>
                </TableCell>
                <TableCell className={cn("text-right font-display text-base font-bold", r.grade?.startsWith("A") && "text-pos")}>{r.grade ?? <span className="text-xs font-normal italic text-muted-foreground">first</span>}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.wins}-{r.losses}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.points}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {signed(r.added)}
                  {r.usual !== null && <span className="block text-xs text-muted-foreground">usual {signed(r.usual)}</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.twoWay === null ? "" : signed(r.twoWay)}
                  {r.twoUsual !== null && <span className="block text-xs text-muted-foreground">usual {signed(r.twoUsual)}</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
