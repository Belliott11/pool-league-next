import { useCallback, useEffect, useMemo, useState } from "react"
import { Award, Check, Vote } from "lucide-react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { IdentityPrompt } from "@/components/WhoAmI"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  addBallot,
  awardDef,
  castAward,
  closeVoting,
  currentBallot,
  finished,
  loadCounts,
  loadMine,
  newBallot,
  numbersPick,
  putBallot,
  reopenVoting,
  revealNext,
  revealing,
  showCard,
  tally,
  undoReveal,
  verdict,
  type Counts,
} from "@/lib/awardVote"
import { getClient } from "@/lib/cloud"
import { myPlayerId, useWho } from "@/lib/identity"
import { useReadOnly } from "@/lib/mode"
import { playerName } from "@/lib/players"
import type { Update } from "@/lib/store"
import type { AwardBallot, PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// The newest ballot's counts (and revealed picks), refreshed every few seconds while voting is open or a reveal is going, and this
// phone's own votes.
function useAwards(state: PooleanState) {
  const b = currentBallot(state)
  const client = getClient()
  const [counts, setCounts] = useState<Counts>({ voters: 0, byAward: {}, picks: {} })
  const [mine, setMine] = useState<Record<string, string>>({})
  const id = b?.id
  const refresh = useCallback(() => {
    if (!client || !id) return
    void loadCounts(client, id).then(setCounts)
    void loadMine(client, id).then(setMine)
  }, [client, id])
  const busy = !!b && (b.open || revealing(b))
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, busy ? 4000 : 30000)
    return () => clearInterval(t)
  }, [refresh, busy, b?.revealed])
  return { b, counts, mine, setMine, refresh, client }
}

// The Games home card while voting is open, during the reveal, and for three weeks after.
export function AwardsCard({ state, onOpen }: { state: PooleanState; onOpen: () => void }) {
  const { b, counts, mine } = useAwards(state)
  const me = myPlayerId(useWho(), state.players)
  if (!b || !showCard(b)) return null
  const voted = Object.keys(mine).length
  const text = b.open
    ? me
      ? voted >= b.awards.length
        ? `Your ballot is in. ${counts.voters} ${counts.voters === 1 ? "player has" : "players have"} voted.`
        : `Vote for the season's awards: ${b.awards.length - voted} left on your ballot.`
      : `The players are voting. ${counts.voters} so far.`
    : finished(b)
      ? "Every award is out. See who won and what the numbers said."
      : b.revealed > 0
        ? `${b.revealed} of ${b.awards.length} awards revealed.`
        : "Voting is closed. The awards are revealed one at a time."
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Award aria-hidden className="size-5 text-gold" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Season awards: {b.label}</p>
          <p className="text-xs text-muted-foreground">{text}</p>
        </div>
        <Button size="sm" onClick={onOpen}>
          {b.open && me && voted < b.awards.length ? (
            <>
              <Vote aria-hidden /> Vote
            </>
          ) : (
            "Open"
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

export function AwardsPage({ state, update, onBack }: { state: PooleanState; update: Update; onBack: () => void }) {
  const readOnly = useReadOnly()
  const { b, counts, mine, setMine, refresh, client } = useAwards(state)
  const me = myPlayerId(useWho(), state.players)
  const [problem, setProblem] = useState("")
  const name = (id: string) => playerName(state, id)
  const numbers = useMemo(() => numbersPick(state), [state])

  const vote = async (award: string, pick: string) => {
    if (!client || !b || !me) return
    const before = mine
    setMine({ ...mine, [award]: pick })
    const r = await castAward(client, b.id, award, me, pick)
    if (r !== "ok") {
      setMine(before)
      setProblem(
        r === "taken"
          ? `Another phone already votes as ${name(me)}, or this phone already voted as someone else. A ballot stays with the phone that started it.`
          : r === "closed"
            ? "Voting has closed."
            : "That vote did not go through. Try again.",
      )
    } else setProblem("")
    refresh()
  }

  return (
    <div className="anim-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Award aria-hidden className="size-5 text-gold" /> Season awards{b ? `: ${b.label}` : ""}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        The players vote, one ballot each and never for themselves. The votes stay secret until each award is revealed, then the site shows
        who the numbers had.
      </p>

      {!readOnly && <EditorControls state={state} update={update} b={b} />}
      {!b && <p className="text-sm text-muted-foreground">No vote yet. The editor starts one at the end of a season.</p>}

      {b && b.revealed > 0 && (
        <section aria-label="Revealed awards" className="flex flex-col gap-3">
          {[...b.awards.slice(0, b.revealed)].reverse().map((k) => {
            const t = tally(counts.picks[k] ?? [])
            const def = awardDef(k)
            const line = verdict(t, numbers[k], name)
            return (
              <Card key={k} className={cn(k === b.awards[b.revealed - 1] && "ring-2 ring-gold/60")}>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{def?.label ?? k}</p>
                  {t.winners.length ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {t.winners.map((id) => (
                        <span key={id} className="flex items-center gap-2">
                          <PlayerAvatar id={id} name={name(id)} />
                          <span className="font-display text-2xl font-bold">{name(id)}</span>
                        </span>
                      ))}
                      {t.winners.length > 1 && <span className="text-sm text-muted-foreground">tied</span>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nobody voted for this one.</p>
                  )}
                  {t.total > 0 && (
                    <ul className="flex flex-col gap-1 text-sm">
                      {t.votes.map((v) => (
                        <li key={v.id} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 truncate">{name(v.id)}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-primary" style={{ width: `${(v.n / t.total) * 100}%` }} />
                          </span>
                          <span className="w-16 shrink-0 text-right tabular-nums">
                            {v.n} {v.n === 1 ? "vote" : "votes"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {line && <p className="text-sm">{line}</p>}
                </CardContent>
              </Card>
            )
          })}
        </section>
      )}

      {b && !b.open && !finished(b) && (
        <p className="text-sm text-muted-foreground">
          Still to come: {b.awards.slice(b.revealed).map((k) => awardDef(k)?.label ?? k).join(", ")}. {counts.voters} {counts.voters === 1 ? "player" : "players"} voted.
        </p>
      )}

      {b && b.open && (
        <section aria-label="Your ballot" className="flex flex-col gap-3">
          <p className="text-sm font-medium">
            {counts.voters} {counts.voters === 1 ? "player has" : "players have"} voted so far.
          </p>
          {!me ? (
            <IdentityPrompt state={state} text="Who are you? Each player gets one ballot." />
          ) : (
            [...b.awards].reverse().map((k) => {
              const def = awardDef(k)
              const pick = mine[k]
              return (
                <Card key={k}>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{def?.label ?? k}</h3>
                      {pick && (
                        <span className="flex items-center gap-1 text-xs text-pos">
                          <Check aria-hidden className="size-3.5" /> Voted
                        </span>
                      )}
                    </div>
                    {def && <p className="text-sm text-muted-foreground">{def.question}</p>}
                    <div role="radiogroup" aria-label={def?.label ?? k} className="flex flex-wrap gap-2">
                      {b.candidates
                        .filter((id) => id !== me)
                        .sort((x, y) => name(x).localeCompare(name(y)))
                        .map((id) => (
                          <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={pick === id}
                            onClick={() => void vote(k, id)}
                            className={cn(
                              "flex min-h-10 items-center gap-2 rounded-full border px-3 py-1 text-sm",
                              pick === id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/60",
                            )}
                          >
                            {name(id)}
                          </button>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
          {problem && <p className="text-sm text-destructive">{problem}</p>}
          {me && <p className="text-xs text-muted-foreground">You can change a vote until voting closes. Nobody sees who you voted for.</p>}
        </section>
      )}
    </div>
  )
}

function EditorControls({ state, update, b }: { state: PooleanState; update: Update; b: AwardBallot | null }) {
  const [label, setLabel] = useState(`Summer ${new Date().getFullYear()}`)
  const put = (next: AwardBallot) => update((s) => putBallot(s, next))
  if (!b || finished(b)) {
    const trial = newBallot(state, label)
    return (
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="font-semibold">Start the vote</p>
          <p className="text-sm text-muted-foreground">
            Players with enough games this season can be voted for: {trial ? trial.candidates.map((id) => playerName(state, id)).join(", ") : "fewer than 3 so far"}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input aria-label="Season name" className="w-48" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button disabled={!trial || !label.trim()} onClick={() => trial && update((s) => addBallot(s, { ...trial, label: label.trim() }))}>
              Open voting
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  const next = b.awards[b.revealed]
  return (
    <Card>
      <CardContent className="flex flex-wrap gap-2">
        {b.open ? (
          <Button variant="outline" onClick={() => put(closeVoting(b))}>
            Close voting
          </Button>
        ) : (
          b.revealed === 0 && (
            <Button variant="outline" onClick={() => put(reopenVoting(b))}>
              Reopen voting
            </Button>
          )
        )}
        {next && <Button onClick={() => put(revealNext(b))}>Reveal {awardDef(next)?.label ?? next}</Button>}
        {b.revealed > 0 && (
          <Button variant="ghost" onClick={() => put(undoReveal(b))}>
            Hide the last award again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
