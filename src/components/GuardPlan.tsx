import { useMemo } from "react"
import { Shield } from "lucide-react"
import { guardPlan, hasHistory, type GuardCall } from "@/lib/guardPlan"
import { liveOpenForVotes } from "@/lib/pickem"
import { MIN_PAIR_SHOTS } from "@/lib/playerDefense"
import { playerName } from "@/lib/players"
import type { Game, PooleanState } from "@/lib/types"

// "Who should guard whom" on both live screens until the first basket (src/lib/guardPlan.ts). A suggestion only.
export function GuardPlanCard({ state, game }: { state: PooleanState; game: Game }) {
  const plan = useMemo(() => guardPlan(state, game), [state, game])
  if (!liveOpenForVotes(game) || !hasHistory(plan)) return null
  const n = (pid: string) => playerName(state, pid)
  const row = (c: GuardCall) => {
    const amt = Math.abs(c.perShot).toFixed(2)
    const why =
      c.shots >= MIN_PAIR_SHOTS
        ? c.perShot >= 0
          ? `${amt} points per shot under ${n(c.scorerId)}'s usual, ${Math.round(c.shots)} shots`
          : `${amt} over ${n(c.scorerId)}'s usual in ${Math.round(c.shots)} shots, but the best of what is left`
        : c.shots > 0
          ? `only ${Math.round(c.shots)} ${Math.round(c.shots) === 1 ? "shot" : "shots"} between them, so mostly ${n(c.defenderId)}'s defense overall`
          : `never matched up, so ${n(c.defenderId)}'s defense overall`
    return (
      <li key={c.defenderId} className="text-sm">
        <span className="font-medium">
          {n(c.defenderId)} on {n(c.scorerId)}
        </span>
        <span className="text-muted-foreground">: {why}</span>
      </li>
    )
  }
  const team = (label: string, color: string, calls: GuardCall[], side: string[]) =>
    calls.length > 0 && (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: color }} /> {label} defending
        </span>
        <ul className="flex flex-col gap-1">
          {calls.map(row)}
          {side
            .filter((p) => !calls.some((c) => c.defenderId === p))
            .map((p) => (
              <li key={p} className="text-sm">
                <span className="font-medium">{n(p)}</span>
                <span className="text-muted-foreground">: the extra player, free to help</span>
              </li>
            ))}
        </ul>
      </div>
    )
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-3" aria-label="Who should guard whom">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Shield aria-hidden className="size-4 text-accent" /> Who should guard whom
      </h3>
      <p className="text-xs text-muted-foreground">From every filmed shot between them. A suggestion; gone at the first basket.</p>
      {team("Team A", "var(--color-team-a)", plan.forA, game.teamA)}
      {team("Team B", "var(--color-team-b)", plan.forB, game.teamB)}
    </section>
  )
}
