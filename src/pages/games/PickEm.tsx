import { Vote as VoteIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { IdentityPrompt } from "@/components/WhoAmI"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { formatDateDisplay } from "@/lib/format"
import { myPlayerId, useWho } from "@/lib/identity"
import { castVote, liveOpenForVotes, loadVotes, openForVotes, pickemStandings, type Vote } from "@/lib/pickem"
import { playerName } from "@/lib/players"
import { PropStandings } from "./Props"
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
  const [refused, setRefused] = useState("") // a game whose vote another phone owns
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
  if (open.length === 0 && standings.rows.length === 0) return <PropOnly state={state} />
  const mine = (gameId: string) => votes.find((v) => v.gameId === gameId && v.voter === me)?.pick
  const vote = async (gameId: string, pick: Side) => {
    if (!me || busy) return
    setBusy(true)
    // Show the vote at once; the next refresh confirms it.
    setVotes((cur) => [...cur.filter((v) => !(v.gameId === gameId && v.voter === me)), { gameId, voter: me, pick }])
    const saved = await castVote(client, gameId, me, pick)
    setRefused(saved ? "" : gameId)
    setBusy(false)
    refresh()
  }
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Pick'em">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <VoteIcon aria-hidden className="size-4 text-accent" /> Pick the winner
      </h3>
      {open.length > 0 && !me && <IdentityPrompt state={state} text="Who are you? Pick yourself to vote." />}
      {open.map((g) => {
        const a = votes.filter((v) => v.gameId === g.id && v.pick === "A").length
        const b = votes.filter((v) => v.gameId === g.id && v.pick === "B").length
        const picked = mine(g.id)
        return (
          <div key={g.id} className="flex flex-col gap-2 rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">{formatDateDisplay(g.date)}</p>
            {refused === g.id && <p role="alert" className="text-xs text-destructive">That vote was made on another phone, so only that phone can change it.</p>}
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
      <PropStandings state={state} />
    </section>
  )
}

// With no Pick'em games yet, the points-lines standings can still show on their own.
function PropOnly({ state }: { state: PooleanState }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 empty:hidden" aria-label="Points lines">
      <PropStandings state={state} />
    </section>
  )
}

// On the live screens, before the first basket: one tap to call the game, with the same phone-owned votes as the Pick'em card (they count
// in its standings once the game is finished). It goes away at the first basket, when voting closes.
export function LivePickem({ state, game }: { state: PooleanState; game: PooleanState["games"][number] }) {
  const client = getClient()
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const [votes, setVotes] = useState<Vote[]>([])
  const [refused, setRefused] = useState(false)
  const open = liveOpenForVotes(game)
  const refresh = useCallback(() => {
    if (client) void loadVotes(client).then((all) => setVotes(all.filter((v) => v.gameId === game.id)))
  }, [client, game.id])
  useEffect(() => {
    if (!open) return
    refresh()
    const t = setInterval(refresh, 10000)
    return () => clearInterval(t)
  }, [refresh, open])
  if (!client || !open) return null
  const picked = votes.find((v) => v.voter === me)?.pick
  const count = (side: Side) => votes.filter((v) => v.pick === side).length
  const vote = async (pick: Side) => {
    if (!me) return
    setVotes((cur) => [...cur.filter((v) => v.voter !== me), { gameId: game.id, voter: me, pick }])
    const ok = await castVote(client, game.id, me, pick)
    setRefused(!ok)
    refresh()
  }
  const names = (ids: string[]) => ids.map((id) => playerName(state, id)).join(", ")
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-3" aria-label="Who wins this one?">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <VoteIcon aria-hidden className="size-4 text-accent" /> Who wins this one? Votes close at the first basket.
      </h3>
      {!me && <p className="text-xs text-muted-foreground">Pick who you are at the top of the page to vote.</p>}
      {refused && <p role="alert" className="text-xs text-destructive">That vote was made on another phone, so only that phone can change it.</p>}
      <div className="grid grid-cols-2 gap-2">
        {(["A", "B"] as const).map((side) => (
          <Button key={side} variant="outline" disabled={!me} aria-pressed={picked === side} className={cn("h-auto min-h-11 whitespace-normal py-2", picked === side && "border-primary bg-primary text-primary-foreground")} onClick={() => void vote(side)}>
            {names(side === "A" ? game.teamA : game.teamB)}
          </Button>
        ))}
      </div>
      {(count("A") + count("B") > 0) && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {count("A")} for {names(game.teamA)}, {count("B")} for {names(game.teamB)}
        </p>
      )}
    </section>
  )
}
