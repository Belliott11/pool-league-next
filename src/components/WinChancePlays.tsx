import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { winProbAdded } from "@/lib/insight"
import { playerName } from "@/lib/players"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import { cn } from "@/lib/utils"
import { winChancePlays } from "@/lib/wpaPlays"
import type { PooleanState } from "@/lib/types"

// Win chance added over every play (wpaPlays.ts), beside the baskets-only version (insight.ts). In points of win chance: 100 is one whole
// game's worth.
const pts = (n: number) => {
  const r = Math.round(n * 100)
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r)}`
}
const tone = (n: number) => (Math.round(n * 100) > 0 ? "text-pos" : "")

export function WinChancePlaysCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const w = useMemo(() => winChancePlays(state), [state])
  const baskets = useMemo(() => new Map(winProbAdded(state).rows.map((r) => [r.id, r.net])), [state])
  if (w.games === 0 || w.rows.length < 3) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Win chance added, every play</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Hint
          text={
            <>
              Every play, not just baskets: misses, rebounds, turnovers and stops all move the win chance, because this one knows who has the
              ball. In points of win chance (100 is one whole win), from {w.games} filmed {w.games === 1 ? "game" : "games"}.
            </>
          }
        />
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">How it is counted</summary>
          <p className="mt-1">
            Each play is split like Points added: shooter and passer (65/35 on an assisted make), the defenders on the shot, the rebounder,
            who turned it over and who forced it. A miss that stays in bounds is valued at what such a miss is usually worth, and the rebound
            settles the rest. Free throws count their points for the shooter. Baskets only is the older version, which counts made baskets and
            the defense on them. Only games with every play in order count{w.skipped ? ` (${w.skipped} left out for plays without video times)` : ""}. Players with
            fewer than {MIN_RANKED} games are in italics.
          </p>
        </details>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Every play</TableHead>
              <TableHead className="text-right">Per game</TableHead>
              <TableHead className="text-right">Shots</TableHead>
              <TableHead className="text-right">Passes</TableHead>
              <TableHead className="text-right">Boards</TableHead>
              <TableHead className="text-right">Defense</TableHead>
              <TableHead className="text-right">Turnovers</TableHead>
              <TableHead className="text-right">Baskets only</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {w.rows.map((r) => (
              <TableRow key={r.id} className={r.games < MIN_RANKED ? "italic" : ""}>
                <TableCell>
                  <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.id)}>
                    {playerName(state, r.id)}
                  </button>
                </TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", tone(r.total))}>{pts(r.total)}</TableCell>
                <TableCell className="text-right tabular-nums">{pts(r.perGame)}</TableCell>
                <TableCell className="text-right tabular-nums">{pts(r.shots)}</TableCell>
                <TableCell className="text-right tabular-nums">{pts(r.passes)}</TableCell>
                <TableCell className="text-right tabular-nums">{pts(r.boards)}</TableCell>
                <TableCell className="text-right tabular-nums">{pts(r.defense)}</TableCell>
                <TableCell className="text-right tabular-nums">{pts(r.turnovers)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{pts(baskets.get(r.id) ?? 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
