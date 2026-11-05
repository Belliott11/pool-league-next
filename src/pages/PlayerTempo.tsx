import { useMemo } from "react"
import { compareRates, pct, PLAYER_PHASE_MIN, VERDICT_LABEL, type Rate } from "@/lib/gameFlow"
import { playerScoreState, TRAIL, tempo } from "@/lib/tempo"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

const pctText = (r: Rate) => (r.att > 0 ? `${Math.round(pct(r)!)}%` : "-")

// One player's shooting by score state beside the league's. Pace, runs and swings belong to a game, not a shooter, so
// they stay on the league card. A tab inside the player's Game flow section. A bucket needs PLAYER_PHASE_MIN shots before its number is shown.
export function ScoreStateBody({ state, pid }: { state: PooleanState; pid: string }) {
  const mine = useMemo(() => playerScoreState(state, pid), [state, pid])
  const league = useMemo(() => tempo(state).state, [state])
  const total = mine.trailing.att + mine.close.att + mine.leading.att
  if (total === 0) return <p className="text-sm text-muted-foreground">No timed shots yet.</p>
  const rows = [["Trailing", mine.trailing, league.trailing], ["Close", mine.close, league.close], ["Leading", mine.leading, league.leading]] as const
  const ok = (r: Rate) => r.att >= PLAYER_PHASE_MIN
  const cmp = ok(mine.trailing) && ok(mine.leading) ? compareRates(mine.trailing, mine.leading) : null
  return (
    <>
      <p className="text-xs text-muted-foreground">
        Shots grouped by the team margin just before the shot: trailing by {TRAIL} or more, within {TRAIL - 1}, or leading by {TRAIL} or more. The basket that ends a game is left out. League numbers sit alongside.
      </p>
      {rows.map(([label, r, l]) => (
        <div key={label} className="flex items-baseline gap-2 text-sm">
          <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
          {ok(r) ? (
            <>
              <span className="font-semibold tabular-nums">{pctText(r)}</span>
              <span className="text-xs text-muted-foreground">{r.made}/{r.att} shots, league {pctText(l)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">needs {PLAYER_PHASE_MIN - r.att} more {PLAYER_PHASE_MIN - r.att === 1 ? "shot" : "shots"} ({r.att} so far)</span>
          )}
        </div>
      ))}
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("rounded-full border px-2 py-0.5 font-medium", cmp?.verdict === "clear" && "border-primary bg-primary/15 text-primary", cmp?.verdict === "hint" && "border-gold text-gold")}>{VERDICT_LABEL[cmp?.verdict ?? "early"]}</span>
        {cmp?.diff != null && <span>Leading against trailing: {cmp.diff > 0 ? "+" : ""}{Math.round(cmp.diff)} points.</span>}
      </p>
    </>
  )
}
