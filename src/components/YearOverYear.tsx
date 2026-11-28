import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { yearOverYear, type YoyRow } from "@/lib/yearOverYear"

// This season against last at the same number of games (yearOverYear.ts), on the Player page's Overview. Shows from season two on.
const fmt = (r: YoyRow, v: number | null) => (v === null ? "-" : r.pct ? `${Math.round(v * 100)}%` : v.toFixed(r.digits))

export function PlayerYearOverYear({ state, pid }: { state: PooleanState; pid: string }) {
  const y = useMemo(() => yearOverYear(state, pid), [state, pid])
  if (!y) return null
  const name = playerName(state, pid)
  const better = (r: YoyRow) => (r.now === null || r.then === null || Math.abs(r.now - r.then) < 1e-9 ? null : (r.now > r.then) === r.higher)
  const up = y.rows.filter((r) => better(r) === true).length
  const down = y.rows.filter((r) => better(r) === false).length
  const rec = (x: [number, number]) => `${x[0]}-${x[1]}`
  return (
    <Card>
      <CardHeader>
        <CardTitle>This season against {y.lastLabel}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          {y.filmed
            ? up === down
              ? `${name} is about where they were at this point last season.`
              : `${name} is ${up > down ? "ahead of" : "behind"} last season's pace on ${Math.max(up, down)} of ${y.rows.length}.`
            : "No filmed games to compare yet."}{" "}
          Record over the first {y.played} {y.played === 1 ? "game" : "games"}: {rec(y.record.now)} now, {rec(y.record.then)} then.
        </p>
        {y.filmed > 0 && (
          <div className="table-scroll overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>First {y.filmed} filmed games</TableHead>
                  <TableHead className="text-right">Now</TableHead>
                  <TableHead className="text-right">Then</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {y.rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className={`text-right tabular-nums ${better(r) === true ? "font-semibold text-pos" : better(r) === false ? "font-semibold" : ""}`}>{fmt(r, r.now)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(r, r.then)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Hint text={`Each season's first ${y.filmed} filmed games side by side, as many as both have, so a fast start is not set against a whole season. The record counts every game, filmed or not, over the first ${y.played}. Small samples early on swing a lot.`} />
      </CardContent>
    </Card>
  )
}
