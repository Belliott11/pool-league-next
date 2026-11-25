import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { pointsAdded, type Epa, type Parts } from "@/lib/epa"
import { playerName } from "@/lib/players"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

// "Points added": every play valued by how far it moves what a trip is worth (src/lib/epa.ts). The league card lists every player and
// what each kind of play and shot is worth; the player card breaks one player's number down.

export const THIN_TRIPS = 20 // fewer trips used than this is an early read, shown in italics
const MIN_SHOT_ROW = 8

export const signed = (n: number, d = 2) => {
  const r = Number(n.toFixed(d))
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(d)}`
}
const tone = (n: number) => (n > 0.0049 ? "text-pos" : "")

export function PlayValues({ epa }: { epa: Epa }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>The play</TableHead>
          <TableHead className="text-right">Points added, on average</TableHead>
          <TableHead className="text-right">Times</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {epa.play
          .filter((p) => p.n > 0)
          .map((p) => (
            <TableRow key={p.label}>
              <TableCell>{p.label}</TableCell>
              <TableCell className={cn("text-right tabular-nums font-semibold", tone(p.epa))}>{signed(p.epa)}</TableCell>
              <TableCell className="text-right tabular-nums">{p.n}</TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  )
}

function ShotValues({ epa }: { epa: Epa }) {
  const rows = epa.byShot.filter((r) => r.att >= MIN_SHOT_ROW && !r.key.startsWith("pts")).sort((a, b) => b.epa - a.epa)
  if (!rows.length) return null
  return (
    <div>
      <div className="mb-1 font-semibold">By shot</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shot</TableHead>
            <TableHead className="text-right">Per shot</TableHead>
            <TableHead className="text-right">Shots</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              <TableCell className={cn("text-right tabular-nums", tone(r.epa))}>{signed(r.epa)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.att}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-1 text-xs text-muted-foreground">Shot types and contest levels with at least {MIN_SHOT_ROW} shots. The shooter gets the whole value here, before an assist takes its share.</p>
    </div>
  )
}

const PARTS: [keyof Parts, string][] = [
  ["shots", "Shots"],
  ["passes", "Passes"],
  ["turnovers", "Turnovers"],
  ["boards", "Off. rebounds"],
  ["defense", "Defense"],
]

function Intro({ epa }: { epa: Epa }) {
  return (
    <p className="text-sm text-muted-foreground">
      A trip with the ball is worth {epa.values.ep.toFixed(2)} points on average. Every play is scored by how far it moves that: a made 2 takes it to 2, a turnover to nothing, a miss
      to what the rebound is still worth (nothing if it goes out of bounds). The defender on a shot takes the other side of it. Add up a player's plays and you get the points they added beyond an average trip.
    </p>
  )
}

export function PointsAddedCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer?: (id: string) => void }) {
  const epa = useMemo(() => pointsAdded(state), [state])
  if (!epa.rows.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Points added</CardTitle>
        <Intro epa={epa} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Per game</TableHead>
              <TableHead className="text-right">Per trip used</TableHead>
              {PARTS.map(([, l]) => (
                <TableHead key={l} className="text-right">
                  {l}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {epa.rows.map((r) => (
              <TableRow key={r.id} className={cn(r.used < THIN_TRIPS && "italic")}>
                <TableCell>
                  {onOpenPlayer ? (
                    <button className="underline-offset-2 hover:underline" onClick={() => onOpenPlayer(r.id)}>
                      {playerName(state, r.id)}
                    </button>
                  ) : (
                    playerName(state, r.id)
                  )}
                </TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", tone(r.perGame))}>{signed(r.perGame, 1)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {signed(r.perTrip)}
                  <span className="block text-xs text-muted-foreground">{r.used} trips</span>
                </TableCell>
                {PARTS.map(([k]) => (
                  <TableCell key={k} className="text-right tabular-nums">
                    {signed(r.perGameParts[k], 1)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="-mt-2 text-xs text-muted-foreground">
          Per game is everything, scaled to an average game. Per trip used is their own shots and turnovers over the trips they ended. Italic rows have fewer than {THIN_TRIPS} trips used, so
          read them as early. An assisted basket's value is shared, most of it to the shooter.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 font-semibold">What each play is worth</div>
            <PlayValues epa={epa} />
          </div>
          <ShotValues epa={epa} />
        </div>
      </CardContent>
    </Card>
  )
}

export function PlayerPointsAdded({ state, pid }: { state: PooleanState; pid: string }) {
  const epa = useMemo(() => pointsAdded(state), [state])
  const r = epa.rows.find((x) => x.id === pid)
  if (!r) return null
  const rank = epa.rows.filter((x) => x.used >= THIN_TRIPS).findIndex((x) => x.id === pid)
  const ranked = epa.rows.filter((x) => x.used >= THIN_TRIPS).length
  const name = playerName(state, pid)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Points added</CardTitle>
        <Intro epa={epa} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          {name} adds <span className={cn("font-semibold", tone(r.perGame))}>{signed(r.perGame, 1)} points</span> a game beyond an average trip
          {rank >= 0 ? `, ${rank + 1} of ${ranked} with ${THIN_TRIPS}+ trips used` : `, from ${r.used} trips used so far, so it is an early read`}. On trips that end with {name}'s own shot or
          turnover: {signed(r.perTrip)} a trip.
        </p>
        <Table>
          <TableBody>
            {PARTS.map(([k, l]) => (
              <TableRow key={k}>
                <TableCell>{l}</TableCell>
                <TableCell className={cn("text-right tabular-nums", tone(r.perGameParts[k]))}>{signed(r.perGameParts[k], 1)} a game</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
