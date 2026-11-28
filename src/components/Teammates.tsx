import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { LEAN, MIN_TOGETHER, strongPairs, teammateFit, recordTogether } from "@/lib/teammates"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { signed } from "@/lib/format"


// Who makes you better (teammates.ts), on the Player page's Matchups tab: each teammate's lift on the player's Points added, the assists
// between them and their record together.
export function PlayerTeammates({ state, pid }: { state: PooleanState; pid: string }) {
  const fits = useMemo(() => teammateFit(state, pid), [state, pid])
  if (!fits.length) return null
  const name = playerName(state, pid)
  const best = fits.find((f) => f.lift !== null && f.lift >= 0.25)
  const rows = fits.slice(0, 10)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who makes {name} better</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          {best
            ? `Best partner so far: ${playerName(state, best.id)}. ${name} adds ${signed(best.withPA)} points a game with them on the team against ${signed(best.withoutPA)} without (${best.together} filmed games together), ${signed(best.lift!)} once leaned toward no difference.`
            : `No teammate stands out yet: the filmed games together are too few to tell a partner apart from a good night.`}
        </p>
        <div className="table-scroll overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teammate</TableHead>
                <TableHead className="text-right">Lift</TableHead>
                <TableHead className="text-right">Record together</TableHead>
                <TableHead className="text-right">Filmed together</TableHead>
                <TableHead className="text-right">Assists between</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>{playerName(state, f.id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.lift === null ? <span className="italic text-muted-foreground">{f.together ? "too few" : "no film"}</span> : signed(f.lift)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.record[0] + f.record[1] ? `${f.record[0]}-${f.record[1]}` : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.together}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.together ? f.assists : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Hint
          text={`Lift is ${name}'s Points added a game with that teammate on the team less without them, in filmed games, leaned toward no difference by ${LEAN} games (it needs ${MIN_TOGETHER} games together and ${MIN_TOGETHER} apart). Assists between counts baskets either one set up for the other. Record together counts every result, the old site's included. Small samples: read it as a hint, not a verdict.`}
        />
      </CardContent>
    </Card>
  )
}

// For the team balancer: pairs on a team whose fit stands out both ways, with their record together.
export function PairNote({ state, teams }: { state: PooleanState; teams: string[][] }) {
  const pairs = teams.flatMap((t) => strongPairs(state, t)).sort((a, b) => b.fit - a.fit).slice(0, 2)
  if (!pairs.length) return null
  return (
    <p className="text-xs text-muted-foreground">
      Good fits kept together:{" "}
      {pairs
        .map((p) => {
          const r = recordTogether(state, p.a, p.b)
          return `${playerName(state, p.a)} and ${playerName(state, p.b)} (${signed(p.fit)} a game each${r[0] + r[1] ? `, ${r[0]}-${r[1]} together` : ""})`
        })
        .join("; ")}
    </p>
  )
}
