import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { BIG_SWING, winProbAdded } from "@/lib/insight"
import { playerName } from "@/lib/players"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import type { PooleanState } from "@/lib/types"

// Clutch squared (insight.ts, `clutch2`): every basket weighted by how far it moved the win chance, squared, so the shots that decide
// games count far more than a pile of early ones. A season total, like the MVP race: being there for more big moments counts.
export function ClutchSquaredCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const w = useMemo(() => winProbAdded(state), [state])
  const rows = w.rows.filter((r) => r.clutch2 > 0).sort((a, b) => b.clutch2 - a.clutch2)
  if (rows.length < 3) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Clutch squared</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Hint
          text={<>
          Every basket weighted by the stakes: how many points of win chance it moved, squared, so a basket that swings a game by 30 points
          counts 36 times as much as one that moves it 5, not 6 times. A pass on a make takes a share. Shown in clutch points (a 30-point
          swing is 9), added up over the season, so being there for more big moments counts. Players with fewer than {MIN_RANKED} games are in
          italics.
          </>}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Clutch²</TableHead>
              <TableHead className="text-right">Big baskets</TableHead>
              <TableHead className="text-right">Biggest</TableHead>
              <TableHead className="text-right">Games</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={r.games < MIN_RANKED ? "italic" : ""}>
                <TableCell>
                  <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.id)}>
                    {playerName(state, r.id)}
                  </button>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{r.clutch2.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.bigBaskets}</TableCell>
                <TableCell className="text-right tabular-nums">{Math.round(r.biggest * 100)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.games}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Big baskets moved the win chance {Math.round(BIG_SWING * 100)} points or more. Biggest is the largest single swing, in points of win
          chance.
        </p>
      </CardContent>
    </Card>
  )
}
