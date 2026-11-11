import { useMemo } from "react"
import { Panel } from "@/components/Panel"
import { PER } from "@/lib/per"
import { computeLeaderboard } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

export const LIVE_TOV_TIP = "Live-ball turnovers are the ones where the other team gets the ball with the defense still moving, so they lead to transition scoring. Stolen or blocked shots are already counted as shots, so they are left out. Lower is better."

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : null
}

// One player's live-ball turnovers per 25 combined points, the share of their turnovers that were live-ball, and the league's middle.
export function PlayerLiveTov({ state, pid }: { state: PooleanState; pid: string }) {
  const { me, mid } = useMemo(() => {
    const rows = computeLeaderboard(state).filter((r) => r.gp > 0)
    return { me: rows.find((r) => r.player.id === pid), mid: median(rows.map((r) => r.liveTovPer25)) }
  }, [state, pid])
  if (!me || me.gp === 0) return null
  const line = (label: string, v: string, sub?: string) => (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="w-44 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{v}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  )
  return (
    <Panel title="Live-ball turnovers" hint={LIVE_TOV_TIP}>
      {line(`Live-ball TOV per ${PER}`, me.liveTovPer25.toFixed(1), mid === null ? undefined : `league middle ${mid.toFixed(1)}`)}
      {line("Share that were live-ball", me.liveTovShare === null ? "-" : `${me.liveTovShare}%`, `${me.tovSplit.liveBall} of ${me.tovSplit.total} turnovers in ${me.gp} games`)}
    </Panel>
  )
}
