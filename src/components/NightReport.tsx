import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlaysToWatch } from "@/components/FilmRoom"
import { formatDateDisplay } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { nightReport, playLine } from "@/lib/nightReport"
import { playerName } from "@/lib/players"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

const signed = (n: number) => {
  const r = Number(n.toFixed(1))
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`
}

// A player's last filmed night, graded (nightReport.ts), near the top of their page. "Your night" on your own page.
export function NightReportCard({ state, pid }: { state: PooleanState; pid: string }) {
  const me = myPlayerId(useWho(), state.players)
  const r = useMemo(() => nightReport(state, pid), [state, pid])
  if (!r || r.nights < 5) return null
  const name = (id: string) => playerName(state, id)
  const own = me === pid
  const record = `${r.wins}-${r.losses}`
  return (
    <Card>
      <CardHeader>
        <CardTitle>{own ? "Your night" : `${name(pid)}'s last night`}: {formatDateDisplay(r.date)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex items-center gap-4">
          <span className={cn("font-display text-5xl font-bold", r.grade.startsWith("A") ? "text-pos" : "")}>{r.grade}</span>
          <p>
            {record} with {r.points} {r.points === 1 ? "point" : "points"}, and {signed(r.added)} points added a game: better than {Math.round(r.beat * 100)}% of the {r.nights} player-nights on record.
          </p>
        </div>
        {r.best && (
          <div className="flex flex-col gap-1">
            <p>
              <span className="text-muted-foreground">Best play: </span>
              {playLine(r.best, name)}
            </p>
            <PlaysToWatch state={state} plays={[r.best]} label="Watch it" />
          </div>
        )}
        {r.fix && (
          <div className="flex flex-col gap-1">
            <p>
              <span className="text-muted-foreground">One to fix: </span>
              {playLine(r.fix, name)}
            </p>
            <PlaysToWatch state={state} plays={[r.fix]} label="Watch it" />
          </div>
        )}
        {r.formBefore !== null && r.formAfter !== null && (
          <p>
            <span className="text-muted-foreground">Form rating: </span>
            {signed(r.formBefore)} to {signed(r.formAfter)} points added a game.
          </p>
        )}
        {r.gameOfNight && (
          <p>
            <span className="text-muted-foreground">Also: </span>
            {own ? "you were" : `${name(pid)} was`} in the{" "}
            <a className="underline" href={`#/games/game/${encodeURIComponent(r.gameOfNight)}`}>
              game of the night
            </a>
            .
          </p>
        )}
        <p className="text-xs text-muted-foreground">The grade compares points added a game that night with every player-night on record: A+ is the top tenth, D the bottom.</p>
      </CardContent>
    </Card>
  )
}
