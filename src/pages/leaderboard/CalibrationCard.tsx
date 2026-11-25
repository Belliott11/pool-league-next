import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { calibration } from "@/lib/calibration"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

// Models tab: whether the live odds mean what they say (src/lib/calibration.ts).
const THIN = 5 // fewer games' worth than this in a band is an early read, in italics

export function CalibrationCard({ state }: { state: PooleanState }) {
  const c = useMemo(() => calibration(state), [state])
  const shown = c.bands.filter((b) => b.moments > 0)
  if (!shown.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Do the live odds mean what they say?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Every moment the odds were given, grouped by how sure they were, against how often the favored team won. {c.games} games, each counting once: results that were never filmed at
          the opening tip, filmed games at every basket. Every call uses only the nights before the game.
        </p>
      </CardHeader>
      <CardContent className="text-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>The odds said</TableHead>
              <TableHead className="text-right">On average</TableHead>
              <TableHead className="text-right">Favorite won</TableHead>
              <TableHead className="text-right">Games' worth</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((b) => {
              const gap = (b.won - b.said) * 100
              return (
                <TableRow key={b.label} className={cn(b.weight < THIN && "italic")}>
                  <TableCell>{b.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(b.said * 100)}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.round(b.won * 100)}%
                    <span className="block text-xs text-muted-foreground">{Math.abs(gap) < 5 ? "about right" : gap > 0 ? "too unsure" : "too sure"}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{b.weight.toFixed(1)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          Well-calibrated odds win about as often as they say. Italic rows have fewer than {THIN} games' worth of moments, so one game can swing them. This fills in as summer games are filmed.
        </p>
      </CardContent>
    </Card>
  )
}
