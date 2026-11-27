import { useMemo } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateDisplay } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { ordinalOf as ordinal } from "@/lib/ordinal"
import { upcomingRsvp } from "@/lib/nightPreview"
import { isOffseason } from "@/lib/offseason"
import { playerName } from "@/lib/players"
import { projectSeason } from "@/lib/projections"
import { rivalries } from "@/lib/rivalries"
import { MIN_GAMES as MIN_RANKED } from "@/lib/ratings"
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"
import mixtapes from "@/data/mixtapes.json"
import { openPageTab } from "@/lib/jump"
import { nextSteps, type Step } from "@/lib/nextSteps"
import { nightReport } from "@/lib/nightReport"
import { ChevronRight } from "lucide-react"

// The top of the Games page for someone who has said who they are: where they stand, what they are close to, who their rival is
// and whether they are down for the next night. Nothing here is new data; it is the league's numbers with the reader picked out.
export function MyCard({ state, onOpenPlayer, go }: { state: PooleanState; onOpenPlayer: (id: string) => void; go: (sub: string) => void }) {
  const me = myPlayerId(useWho(), state.players)
  const d = useMemo(() => {
    if (!me) return null
    const board = computeLeaderboard(state).filter((r) => r.gp >= MIN_RANKED)
    const row = board.find((r) => r.player.id === me)
    const season = projectSeason(state)
    const rival = rivalries(state, 200).find((r) => r.a === me || r.b === me)
    const report = nightReport(state, me)
    return {
      row,
      rank: row ? board.filter((r) => r.twoWayPer25 > row.twoWayPer25).length + 1 : null,
      ranked: board.length,
      milestone: season.milestones.find((m) => m.id === me),
      // Place in the race as it stands, by total so far (the projection list is ordered by chance instead).
      mvp: season.mvp.some((p) => p.id === me) ? season.mvp.filter((p) => p.now > season.mvp.find((x) => x.id === me)!.now).length : -1,
      rival,
      next: upcomingRsvp(state),
      steps: nextSteps(state, me, { mixtape: me in (mixtapes as Record<string, unknown>), rival: rival ? (rival.a === me ? rival.b : rival.a) : null, night: report && report.grade ? { grade: report.grade, date: report.date } : null }),
    }
  }, [state, me])
  if (!me || !d) return null
  const follow = (s: Step) => {
    if (s.go.kind === "sub") go(s.go.sub)
    else if (s.go.kind === "tab") {
      onOpenPlayer(me)
      openPageTab("player", s.go.tab)
    } else document.getElementById(s.go.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const lines: string[] = []
  if (d.row && d.rank) lines.push(`You are ${ordinal(d.rank)} of ${d.ranked} in the standings at ${d.row.twoWayPer25.toFixed(1)} two-way per game, with a ${d.row.wins}-${d.row.losses} record.`)
  else lines.push(`You are not ranked yet. That takes ${MIN_RANKED} filmed games with even teams, and your page has everything so far.`)
  const over = isOffseason(state)
  if (d.mvp >= 0 && over) lines.push(`You finished ${ordinal(d.mvp + 1)} in the MVP race.`)
  if (d.milestone && !over) lines.push(`You are ${d.milestone.next - d.milestone.pts} points from ${d.milestone.next} this season.`)
  if (d.rival) {
    const mine = d.rival.a === me ? d.rival.aWins : d.rival.bWins
    const theirs = d.rival.a === me ? d.rival.bWins : d.rival.aWins
    const other = d.rival.a === me ? d.rival.b : d.rival.a
    const streak = d.rival.streak >= 2 ? (d.rival.streakBy === me ? ` You have won the last ${d.rival.streak}.` : ` ${playerName(state, other)} has won the last ${d.rival.streak}.`) : ""
    lines.push(`Your biggest rivalry: you are ${mine}-${theirs} against ${playerName(state, other)}.${streak}`)
  }
  if (d.next) lines.push(d.next.playerIds.includes(me) ? `You are down for ${formatDateDisplay(d.next.date)}, with ${d.next.playerIds.length - 1} others.` : `${d.next.playerIds.length} are down for ${formatDateDisplay(d.next.date)}. You are not on the list yet.`)
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <PlayerAvatar id={me} name={playerName(state, me)} />
          <h2 className="font-display text-lg font-bold">{playerName(state, me)}, here is where you stand</h2>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {d.steps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Next up for you</h3>
            <ul className="flex flex-col divide-y rounded-xl border">
              {d.steps.map((s) => (
                <li key={s.key}>
                  <button type="button" onClick={() => follow(s)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50">
                    <span className="min-w-0 flex-1">{s.text}</span>
                    <span className="flex shrink-0 items-center gap-0.5 font-medium text-primary">
                      {s.button}
                      <ChevronRight aria-hidden className="size-4" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button size="sm" variant="outline" className="self-start" onClick={() => onOpenPlayer(me)}>
          Open your page
        </Button>
      </CardContent>
    </Card>
  )
}
