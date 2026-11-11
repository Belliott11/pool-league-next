import { useMemo } from "react"
import { adviseMatchups, MIN_GAMES } from "@/lib/matchupAdvice"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Who should guard whom for the two teams in an option. Suggestions only: nothing is saved and balancing is not touched.
export function MatchupAdvice({ state, teamA, teamB }: { state: PooleanState; teamA: string[]; teamB: string[] }) {
  const sides = useMemo(() => adviseMatchups(state, teamA, teamB), [state, teamA, teamB])
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm font-semibold">Suggestions come from small samples.</p>
      <p className="text-xs text-muted-foreground">Faded lines have a player with fewer than {MIN_GAMES} games. Defenders are judged on opponent FG% without beat shots and on Beat Rate, scorers on points per shot without breakdown shots, shots at the rim and usage.</p>
      {sides.map((side) => (
        <div key={side.forTeam} className="flex flex-col gap-2">
          <p className="text-sm font-medium">Team {side.forTeam} defenders</p>
          <ul className="flex flex-col gap-2">
            {side.list.map((s) => (
              <li key={s.scorer.id} className={cn("flex flex-col gap-0.5 border-t pt-2 text-sm", s.thin && "opacity-50")}>
                <span>
                  <span className="font-semibold">{playerName(state, s.defender.id)}</span> guards <span className="font-semibold">{playerName(state, s.scorer.id)}</span>
                </span>
                <span className="text-xs">{s.reason}</span>
                <span className="text-xs text-muted-foreground">
                  {playerName(state, s.defender.id)}: {s.defender.faced} shots faced, {s.defender.games} games. {playerName(state, s.scorer.id)}: {s.scorer.shots} shots, {s.scorer.games} games, {Math.round(s.scorer.rimShare * 100)}% at the rim.
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
