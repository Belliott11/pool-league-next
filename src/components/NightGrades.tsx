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
      <p className="text-xs text-muted-foreground">Each player against their own usual level, so an A is a great night for them, not a ranking. A first filmed night has no grade yet.</p>
      <div className="table-scroll overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Grade</TableHead>
              <TableHead className="text-right">Record</TableHead>
              <TableHead className="text-right">Pts</TableHead>
              <TableHead className="text-right">Added a game</TableHead>
              <TableHead className="text-right">Usual</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.pid}>
                <TableCell>
                  <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.pid)}>
                    {playerName(state, r.pid)}
                  </button>
                </TableCell>
                <TableCell className={cn("text-right font-display text-base font-bold", r.grade?.startsWith("A") && "text-pos")}>{r.grade ?? <span className="text-xs font-normal italic text-muted-foreground">first</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{r.wins}-{r.losses}</TableCell>
                <TableCell className="text-right tabular-nums">{r.points}</TableCell>
                <TableCell className="text-right tabular-nums">{signed(r.added)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{r.usual === null ? "" : signed(r.usual)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
