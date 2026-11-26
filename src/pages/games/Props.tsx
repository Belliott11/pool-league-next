import { useCallback, useEffect, useMemo, useState } from "react"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { myPlayerId, useWho } from "@/lib/identity"
import { liveOpenForVotes } from "@/lib/pickem"
import { playerName } from "@/lib/players"
import { castProp, linesFor, loadProps, propStandings, type PropPick, type PropSide } from "@/lib/props"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Prop picks on the live screens, under "Who wins this one?": over or under each player's points line, until the first basket.
export function LiveProps({ state, game }: { state: PooleanState; game: PooleanState["games"][number] }) {
  const client = getClient()
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const [picks, setPicks] = useState<PropPick[]>([])
  const [refused, setRefused] = useState("")
  const open = liveOpenForVotes(game)
  const lines = useMemo(() => linesFor(state, game), [state, game])
  const refresh = useCallback(() => {
    if (client) void loadProps(client, game.id).then(setPicks)
  }, [client, game.id])
  useEffect(() => {
    if (!open) return
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [refresh, open])
  if (!client || !open) return null
  const pick = async (pid: string, side: PropSide) => {
    if (!me || me === pid) return
    setPicks((cur) => [...cur.filter((p) => !(p.pid === pid && p.voter === me)), { gameId: game.id, pid, voter: me, pick: side }])
    const ok = await castProp(client, game.id, pid, me, side, lines.get(pid)!)
    setRefused(ok ? "" : pid)
    refresh()
  }
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-3" aria-label="Points lines">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <TrendingUp aria-hidden className="size-4 text-accent" /> Points lines: over or under? Picks close at the first basket.
      </h3>
      {!me && <p className="text-xs text-muted-foreground">Pick who you are at the top of the page to pick.</p>}
      <ul className="flex flex-col gap-1.5">
        {[...game.teamA, ...game.teamB].map((pid) => {
          const mine = picks.find((p) => p.pid === pid && p.voter === me)?.pick
          const n = (s: PropSide) => picks.filter((p) => p.pid === pid && p.pick === s).length
          const self = pid === me
          return (
            <li key={pid} className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{playerName(state, pid)}</span> <span className="tabular-nums text-muted-foreground">{lines.get(pid)} points</span>
              </span>
              {self ? (
                <span className="text-xs text-muted-foreground">Your own line</span>
              ) : (
                (["over", "under"] as const).map((s) => (
                  <Button key={s} size="sm" variant="outline" disabled={!me} aria-pressed={mine === s} aria-label={`${s === "over" ? "Over" : "Under"} ${lines.get(pid)} for ${playerName(state, pid)}`} className={cn("min-w-20 tabular-nums", mine === s && "border-primary bg-primary text-primary-foreground")} onClick={() => void pick(pid, s)}>
                    {s === "over" ? "Over" : "Under"} {n(s) ? `(${n(s)})` : ""}
                  </Button>
                ))
              )}
              {refused === pid && <p role="alert" className="w-full text-xs text-destructive">That pick did not save: it was made on another phone, or the game has started.</p>}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">Each line is the player's points per game so far, scaled to this game's target and leaned toward the league's.</p>
    </section>
  )
}

// The points-lines standings, for the Pick'em card on the Games home.
export function PropStandings({ state }: { state: PooleanState }) {
  const client = getClient()
  const [picks, setPicks] = useState<PropPick[]>([])
  useEffect(() => {
    if (client) void loadProps(client).then(setPicks)
  }, [client, state])
  const rows = useMemo(() => propStandings(state, picks), [state, picks])
  if (!rows.length) return null
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-semibold">Points lines</h4>
      <ul className="flex flex-col gap-0.5 text-sm" aria-label="Points lines standings">
        {rows.slice(0, 8).map((r, i) => (
          <li key={r.voter} className="flex justify-between">
            <span>
              {i + 1}. {playerName(state, r.voter)}
            </span>
            <span className="tabular-nums">
              {r.right} of {r.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
