import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Hint } from "@/components/Hint"
import { EARLY, fatigue, LEAN } from "@/lib/fatigue"
import { BANDS, fatigue as dayLoad, LOW_SAMPLE } from "@/lib/dayLoad"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { signed } from "@/lib/format"


// Do players tire? (fatigue.ts): the league's shooting by game number in a night, and who plays better early or late. Also, folded, the
// win-loss record by how many games a player had already played that day over every result (dayLoad.ts; it was its own panel).
export function FatigueCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const f = useMemo(() => fatigue(state), [state])
  if (f.buckets.length < 2) return null
  const late = f.players.filter((p) => p.gap > 0.25).slice(0, 3)
  const early = [...f.players].reverse().filter((p) => p.gap < -0.25).slice(0, 3)
  const verdict = f.real
    ? f.late.pps < f.early.pps
      ? `Shooting drops later in a night: ${f.late.pps.toFixed(2)} points a shot from game ${EARLY + 1} on, against ${f.early.pps.toFixed(2)} in games 1 and ${EARLY}, more than chance would make.`
      : `Shooting gets better later in a night: ${f.late.pps.toFixed(2)} points a shot from game ${EARLY + 1} on, against ${f.early.pps.toFixed(2)} early, more than chance would make.`
    : `No sign of it yet: ${f.early.pps.toFixed(2)} points a shot in games 1 and ${EARLY}, ${f.late.pps.toFixed(2)} after, a gap chance alone could make.`
  const who = (list: typeof late) =>
    list.map((p, i) => (
      <span key={p.id}>
        {i > 0 && ", "}
        <button type="button" className="hover:underline" onClick={() => onOpenPlayer(p.id)}>
          {playerName(state, p.id)}
        </button>{" "}
        ({signed(p.gap)})
      </span>
    ))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Do players tire?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Hint text={`Every filmed night's games in the order they were played, then how the league shot and looked after the ball by game number. Players: Points added a game in games 1 and ${EARLY} against later games, leaning toward no difference by ${LEAN} games so one late dud is not a verdict.`} />
        <p>{verdict}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Game of the night</TableHead>
              <TableHead className="text-right">Points a shot</TableHead>
              <TableHead className="text-right">Made</TableHead>
              <TableHead className="text-right">Turnovers / 10 trips</TableHead>
              <TableHead className="text-right">Games</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {f.buckets.map((b) => (
              <TableRow key={b.label}>
                <TableCell>{b.label}</TableCell>
                <TableCell className="text-right tabular-nums">{b.pps.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{Math.round(b.fg * 100)}%</TableCell>
                <TableCell className="text-right tabular-nums">{b.turnovers.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{b.games}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {late.length > 0 && <p><span className="text-muted-foreground">Better later in a night: </span>{who(late)}</p>}
        {early.length > 0 && <p><span className="text-muted-foreground">Better early: </span>{who(early)}</p>}
        <p className="text-xs text-muted-foreground">Player numbers are Points added a game, later games less early ones, leaned toward no difference.</p>
        <DayLoad state={state} onOpenPlayer={onOpenPlayer} />
      </CardContent>
    </Card>
  )
}

// Win-loss by games already played that day, over every result (old site included, so unfilmed games count).
function DayLoad({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => dayLoad(state), [state])
  if (!rows.length) return null
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">Win-loss by game of the day, every result</summary>
      <div className="table-scroll mt-2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              {BANDS.map((b) => (
                <TableHead key={b.key} className="text-right">{b.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id || "all"}>
                <TableCell>
                  {r.id === "" ? <span className="font-medium">Everyone</span> : <button type="button" className="hover:underline" onClick={() => onOpenPlayer(r.id)}>{playerName(state, r.id)}</button>}
                </TableCell>
                {BANDS.map((b) => {
                  const v = r.bands[b.key]
                  const n = v.w + v.l
                  return (
                    <TableCell key={b.key} className={`text-right tabular-nums ${n > 0 && n < LOW_SAMPLE ? "italic" : ""}`}>
                      {n === 0 ? "" : `${v.w}-${v.l}`}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Italics: fewer than {LOW_SAMPLE} games. Winners tend to stay on and play more games in a row, so this flatters the later columns.</p>
    </details>
  )
}

// One player's line, for their History tab.
export function PlayerFatigue({ state, pid }: { state: PooleanState; pid: string }) {
  const f = useMemo(() => fatigue(state), [state])
  const p = f.players.find((x) => x.id === pid)
  if (!p) return null
  const name = playerName(state, pid)
  const lean = Math.abs(p.gap) < 0.25 ? "about the same early and late" : p.gap > 0 ? "better later in a night" : "better early in a night"
  return (
    <Card>
      <CardHeader>
        <CardTitle>Early or late?</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {name} plays {lean}: {signed(p.early)} points added a game in games 1 and {EARLY} ({p.earlyGames} {p.earlyGames === 1 ? "game" : "games"}), {signed(p.late)} after ({p.lateGames}). Leaned toward no difference: {signed(p.gap)}.
      </CardContent>
    </Card>
  )
}
