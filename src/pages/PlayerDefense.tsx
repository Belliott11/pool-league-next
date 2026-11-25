import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { defenseTable, MIN_PAIR_SHOTS, MIN_RANK_SHOTS, playerDefense, PRIOR_SHOTS, type Pair } from "@/lib/playerDefense"
import { playerName } from "@/lib/players"
import { ordinalOf } from "@/lib/ordinal"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

// The Defense tab's first card: who this player stops and who scores on them, against what the same shooters score on everyone else,
// and the same from the other side (who holds this player down). The math is in src/lib/playerDefense.ts.

const THIN = 8 // fewer shots than this between two players is an early read, in italics
const signed = (n: number, d = 1) => {
  const r = Number(n.toFixed(d))
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(d)}`
}
const shots = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Tile({ label, value, note, good }: { label: string; value: string; note?: string; good?: boolean }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("font-display text-2xl font-bold tabular-nums", good && "text-pos")}>{value}</div>
      {note && <div className="text-xs text-muted-foreground">{note}</div>}
    </div>
  )
}

function PairTable({ state, rows, who, against, defenseView }: { state: PooleanState; rows: Pair[]; who: string; against: string; defenseView: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{who}</TableHead>
          <TableHead className="text-right">Shots</TableHead>
          <TableHead className="text-right">Usual</TableHead>
          <TableHead className="text-right">{against}</TableHead>
          <TableHead className="text-right">Saved</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => {
          const per = p.allowed / p.shots
          const good = p.saved > 0
          return (
            <TableRow key={`${p.defenderId}|${p.scorerId}`} className={cn(p.shots < THIN && "italic")}>
              <TableCell>{playerName(state, defenseView ? p.scorerId : p.defenderId)}</TableCell>
              <TableCell className="text-right tabular-nums">{shots(p.shots)}</TableCell>
              <TableCell className="text-right tabular-nums">{p.usual.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums">{per.toFixed(2)}</TableCell>
              <TableCell className={cn("text-right tabular-nums", good && "text-pos font-semibold")}>{signed(p.saved)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function PlayerDefense({ state, pid }: { state: PooleanState; pid: string }) {
  const table = useMemo(() => defenseTable(state), [state])
  const d = useMemo(() => playerDefense(table, pid), [table, pid])
  const name = playerName(state, pid)
  if (!d.me && !d.guardedBy.length) return null
  const me = d.me
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Who stops whom</CardTitle>
        <p className="text-sm text-muted-foreground">
          Every shot {name} guarded, against what the same shooters score on everyone else, and the defenders who hold {name} down. Points are per shot (2s and 3s); the league
          scores {table.league.toFixed(2)} a shot.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {me && me.shots > 0 && (
          <>
            <p>
              {name} guarded {shots(me.shots)} shots. Those shooters score {(me.expected / me.shots).toFixed(2)} a shot against everyone else and {(me.allowed / me.shots).toFixed(2)} against{" "}
              {name}: <span className={cn("font-semibold", me.saved10 > 0 && "text-pos")}>{signed(me.saved10)} points</span> per 10 shots guarded
              {d.rank ? `, ${ordinalOf(d.rank)} of ${d.ranked} with ${MIN_RANK_SHOTS}+ shots guarded` : `. With fewer than ${MIN_RANK_SHOTS} shots guarded, it is an early read`}.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Saved per 10 shots" value={signed(me.saved10)} good={me.saved10 > 0} note="against their usual" />
              <Tile label="Shots guarded" value={shots(me.shots)} />
              <Tile label="Beaten on" value={`${Math.round((me.beaten / me.shots) * 100)}%`} note="shooter got past" />
              <Tile label="Heavy contests" value={me.contested ? `${Math.round((me.heavy / me.contested) * 100)}%` : "-"} note="of shots with a contest logged" />
            </div>
          </>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 font-semibold">Guarding</div>
            {d.guarding.length ? (
              <PairTable state={state} rows={d.guarding} who="Shooter" against={`On ${name}`} defenseView />
            ) : (
              <p className="text-muted-foreground">No shooter yet with {MIN_PAIR_SHOTS} or more shots against {name}.</p>
            )}
          </div>
          <div>
            <div className="mb-1 font-semibold">When {name} shoots</div>
            {d.guardedBy.length ? (
              <PairTable state={state} rows={d.guardedBy} who="Defender" against="Against them" defenseView={false} />
            ) : (
              <p className="text-muted-foreground">No defender yet with {MIN_PAIR_SHOTS} or more of {name}'s shots.</p>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Usual is the shooter's points per shot when anyone else guarded them, leaning on the league's as if they had {PRIOR_SHOTS} more shots, so one hot night does not decide it.
          Saved is the points kept off the board against that. A shot guarded by two people counts half for each; with no defender tagged, the game's matchups list says who was on the shooter, but only on a contested shot (an
          uncontested one usually means the listed defender was not there, so nobody is charged). Pairs with at least {MIN_PAIR_SHOTS} shots are listed; italic rows have fewer than {THIN}.
        </p>
      </CardContent>
    </Card>
  )
}
