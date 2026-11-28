import { useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { BIG_SWING, winChancePlays } from "@/lib/wpaPlays"
import { playerName } from "@/lib/players"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import type { PooleanState } from "@/lib/types"

// Clutch squared (wpaPlays.ts, `clutch2`): every play weighted by how far it moved the win chance, squared with its sign, so the plays
// that decided games count far more than a pile of early ones, good or bad. A season total, like the MVP race. A view of the Win chance
// added card (WinChancePlays.tsx).
export function ClutchSquaredTable({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const w = useMemo(() => winChancePlays(state), [state])
  const rows = w.rows.filter((r) => r.clutch2 !== 0).sort((a, b) => b.clutch2 - a.clutch2)
  if (rows.length < 3) return <p className="text-sm text-muted-foreground">Shows up once three players have plays in games with every play in order.</p>
  return (
    <>
        <Hint
          text={<>
          Every play weighted by the stakes: how many points of win chance it moved, squared, so a play that swings a game by 30 points
          counts 36 times as much as one that moves it 5. Good plays add and costly ones take away: a stop or a basket at game point adds a
          lot, a turnover there takes a lot back, early plays barely register. Shared out like Win chance added, every play. In clutch
          points (a 30-point swing is 9), over the season. Players with fewer than {MIN_RANKED} games are in italics.
          </>}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Clutch²</TableHead>
              <TableHead className="text-right">Big plays</TableHead>
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
                <TableCell className="text-right font-semibold tabular-nums">{r.clutch2 < 0 ? "−" : ""}{Math.abs(r.clutch2).toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.bigPlays}</TableCell>
                <TableCell className="text-right tabular-nums">{Math.round(r.biggest * 100)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.games}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Big plays swung the win chance {Math.round(BIG_SWING * 100)} points or more their team's way with them in the play (a basket, a pass, a
          stop, a rebound). Biggest is the largest of those swings, in points of win chance.
        </p>
    </>
  )
}
