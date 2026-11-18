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
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"
import { chance } from "./Projections"

// The top of the Games page for someone who has said who they are: where they stand, what they are close to, who their rival is
// and whether they are down for the next night. Nothing here is new data; it is the league's numbers with the reader picked out.
export function MyCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const me = myPlayerId(useWho(), state.players)
  const d = useMemo(() => {
    if (!me) return null
    const board = computeLeaderboard(state).filter((r) => r.gp > 0)
    const row = board.find((r) => r.player.id === me)
    const season = projectSeason(state)
    const rival = rivalries(state, 200).find((r) => r.a === me || r.b === me)
    return {
      row,
      rank: row ? board.filter((r) => r.twoWayPer25 > row.twoWayPer25).length + 1 : null,
      ranked: board.length,
      milestone: season.milestones.find((m) => m.id === me),
      // Place in the race as it stands, by total so far (the projection list is ordered by chance instead).
      mvp: season.mvp.some((p) => p.id === me) ? season.mvp.filter((p) => p.now > season.mvp.find((x) => x.id === me)!.now).length : -1,
      mvpWin: season.mvp.find((p) => p.id === me)?.win,
      rival,
      next: upcomingRsvp(state),
    }
  }, [state, me])
  if (!me || !d) return null
  const lines: string[] = []
  if (d.row && d.rank) lines.push(`You are ${ordinal(d.rank)} of ${d.ranked} in the standings at ${d.row.twoWayPer25.toFixed(1)} two-way per game, with a ${d.row.wins}-${d.row.losses} record.`)
  else lines.push("You are not ranked yet. That takes one filmed game with even teams.")
  const over = isOffseason(state)
  if (d.mvp >= 0 && over) lines.push(`You finished ${ordinal(d.mvp + 1)} in the MVP race.`)
  if (d.mvp >= 0 && !over) lines.push(`MVP race: ${ordinal(d.mvp + 1)} on the stats, and projected to lead them in ${chance(d.mvpWin!)} of seasons if it runs 20 more filmed games. The award itself is voted.`)
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
        <Button size="sm" variant="outline" className="self-start" onClick={() => onOpenPlayer(me)}>
          Open your page
        </Button>
      </CardContent>
    </Card>
  )
}
