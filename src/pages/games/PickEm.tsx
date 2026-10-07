import { Vote as VoteIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { formatDateDisplay } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { castVote, loadVotes, openForVotes, pickemStandings, type Vote } from "@/lib/pickem"
import { playerName } from "@/lib/players"
import type { Side } from "@/lib/scorecard"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Pick the winner before a game starts, and see who has called the most right, next to the model.
export function PickEmCard({ state }: { state: PooleanState }) {
  const client = getClient()
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const [votes, setVotes] = useState<Vote[]>([])
  const [busy, setBusy] = useState(false)
  const open = openForVotes(state)
  const refresh = useCallback(() => {
    if (client) void loadVotes(client).then(setVotes)
  }, [client])
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, open.length > 0 ? 15000 : 60000)
    return () => clearInterval(t)
  }, [refresh, open.length])
  if (!client) return null
  const standings = pickemStandings(state, votes)
  if (open.length === 0 && standings.rows.length === 0) return null
  const mine = (gameId: string) => votes.find((v) => v.gameId === gameId && v.voter === me)?.pick
  const vote = async (gameId: string, pick: Side) => {
    if (!me || busy) return
    setBusy(true)
    // Show the vote at once; the next refresh confirms it.
    setVotes((cur) => [...cur.filter((v) => !(v.gameId === gameId && v.voter === me)), { gameId, voter: me, pick }])
    await castVote(client, gameId, me, pick)
    setBusy(false)
    refresh()
  }
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Pick'em">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <VoteIcon aria-hidden className="size-4 text-accent" /> Pick the winner
      </h3>
      {open.length > 0 && !me && <p className="text-sm text-muted-foreground">Say who you are (top right) to vote.</p>}
      {open.map((g) => {
        const a = votes.filter((v) => v.gameId === g.id && v.pick === "A").length
        const b = votes.filter((v) => v.gameId === g.id && v.pick === "B").length
        const picked = mine(g.id)
        return (
          <div key={g.id} className="flex flex-col gap-2 rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">{formatDateDisplay(g.date)}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as const).map((side) => (
                <Button key={side} variant="outline" disabled={!me} aria-pressed={picked === side} className={cn("h-auto min-h-11 whitespace-normal py-2", picked === side && "border-primary bg-primary text-primary-foreground")} onClick={() => void vote(g.id, side)}>
                  {names(side === "A" ? g.teamA : g.teamB)}
                </Button>
              ))}
            </div>
            {picked && (
              <p className="text-xs text-muted-foreground">
                You picked Team {picked}. Votes so far: {a} for A, {b} for B.
              </p>
            )}
          </div>
        )
      })}
      {standings.rows.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold">Standings</h4>
          <ul className="flex flex-col gap-0.5 text-sm" aria-label="Pick'em standings">
            {standings.rows.slice(0, 8).map((r, i) => (
              <li key={r.voter} className="flex justify-between">
                <span>
                  {i + 1}. {playerName(state, r.voter)}
                </span>
                <span className="tabular-nums">
                  {r.right} of {r.total}
                </span>
              </li>
            ))}
            {standings.model.total > 0 && (
              <li className="flex justify-between text-muted-foreground">
                <span>The model, on the same games</span>
                <span className="tabular-nums">
                  {standings.model.right} of {standings.model.total}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  )
}
