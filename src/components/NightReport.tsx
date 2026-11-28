import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlaysToWatch } from "@/components/FilmRoom"
import { formatDateDisplay, signed } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { nightReport, playLine } from "@/lib/nightReport"
import { playerName } from "@/lib/players"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"


// A player's last filmed night, graded (nightReport.ts), near the top of their page. "Your night" on your own page.
export function NightReportCard({ state, pid }: { state: PooleanState; pid: string }) {
  const me = myPlayerId(useWho(), state.players)
  const r = useMemo(() => nightReport(state, pid), [state, pid])
  if (!r) return null
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
          {r.grade && <span className={cn("font-display text-5xl font-bold", r.grade.startsWith("A") ? "text-pos" : "")}>{r.grade}</span>}
          <p>
            {record} with {r.points} {r.points === 1 ? "point" : "points"}, and {signed(r.added)} points added a game
            {r.usual !== null ? (
              <>
                {" "}against {own ? "your" : "their"} usual {signed(r.usual)}
                {r.bar !== null && r.bar !== r.usual ? <> (the bar for a B: {signed(r.bar)}, a small step up)</> : null}.
              </>
            ) : (
              <>. {own ? "Your" : "Their"} first filmed night: a grade comes after the next one.</>
            )}
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
        {r.grade && (
          <p className="text-xs text-muted-foreground">
            Graded against {own ? "your" : "their"} own level, never anyone else&apos;s: the night against {own ? "your" : "their"} usual (the form rating going in), allowing for how much any night swings by chance. Below the league average, the bar for a B sits a quarter of the way up toward it, so a B means a step forward. A+ is one of {own ? "your" : "their"} best nights, C or D an off night.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
