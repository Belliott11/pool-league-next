import { useCallback, useEffect, useMemo, useState } from "react"
import { Award, Check, Vote, X } from "lucide-react"
import { PastAwards } from "@/components/PastAwards"
import { ImprovingCard } from "@/components/Improving"
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
  pairId,
  pairOf,
  places,
  putBallot,
  reopenVoting,
  revealNext,
  revealing,
  roundsInWords,
  runoff,
  showCard,
  toggleRank,
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
  const [mine, setMine] = useState<Record<string, string[]>>({})
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
  const voted = Object.values(mine).filter((r) => r.length > 0).length
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
  // A pair's id reads "Ben and Phillip".
  const label = (id: string) => pairOf(id).map(name).join(" and ")
  const numbers = useMemo(() => numbersPick(state), [state])
  // On a duo award, the first player tapped waits here for the second.
  const [half, setHalf] = useState<Record<string, string | null>>({})

  // Saves a ballot for one award after every change.
  const save = async (award: string, next: string[]) => {
    if (!client || !b || !me) return
    if (!next.length) {
      setProblem("Keep at least one ranked. Add another first to change your top choice.")
      return
    }
    const before = mine
    setMine({ ...mine, [award]: next })
    const r = await castAward(client, b.id, award, me, next)
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
  // A tap adds a player to the end of the ranking, or takes them out (the rest move up).
  const tap = (award: string, id: string) => void save(award, toggleRank(mine[award] ?? [], id))
  // On a duo award: the first tap picks a player, the second makes the pair and ranks it next (or takes it out if it was ranked).
  const tapDuo = (award: string, id: string) => {
    const first = half[award]
    if (!first) return setHalf({ ...half, [award]: id })
    setHalf({ ...half, [award]: null })
    if (first === id) return
    void save(award, toggleRank(mine[award] ?? [], pairId(first, id)))
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
        The players vote, one ballot each and never for themselves, ranking as many players as they like. Ranked choice: when nobody has a
        majority of first choices, the player with the fewest is knocked out and those ballots move to their next choice, until someone
        does. The votes stay secret until each award is revealed, then the site shows who the numbers had.
      </p>

      {!readOnly && <EditorControls state={state} update={update} b={b} />}
      {!b && <p className="text-sm text-muted-foreground">No vote yet this season. The editor opens it at the end of the season. Last season's results are below.</p>}

      {b && b.revealed > 0 && (
        <section aria-label="Revealed awards" className="flex flex-col gap-3">
          {[...b.awards.slice(0, b.revealed)].reverse().map((k) => {
            const def = awardDef(k)
            if (def?.kind === "teams") return <TeamsResult key={k} title={def.label} description={def.description} ballots={counts.picks[k] ?? []} name={name} latest={k === b.awards[b.revealed - 1]} />
            const t = runoff(counts.picks[k] ?? [])
            const line = verdict(t, numbers[k], name)
            const last = t.rounds.at(-1)
            const words = roundsInWords(t, name)
            return (
              <Card key={k} className={cn(k === b.awards[b.revealed - 1] && "ring-2 ring-gold/60")}>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{def?.label ?? k}</p>
                    {def && <p className="mt-0.5 text-xs text-muted-foreground">{def.description}</p>}
                  </div>
                  {t.winners.length ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {t.winners.map((id) => (
                        <span key={id} className="flex items-center gap-2">
                          <span className="flex -space-x-2">
                            {pairOf(id).map((p) => (
                              <PlayerAvatar key={p} id={p} name={name(p)} />
                            ))}
                          </span>
                          <span className="font-display text-2xl font-bold">{label(id)}</span>
                        </span>
                      ))}
                      {t.winners.length > 1 && <span className="text-sm text-muted-foreground">tied</span>}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nobody voted for this one.</p>
                  )}
                  {last && last.active > 0 && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        {t.rounds.length === 1 ? `First choices, ${t.total} ${t.total === 1 ? "ballot" : "ballots"}` : `Final round of ${t.rounds.length}, ${last.active} of ${t.total} ballots still counting`}
                      </p>
                      <ul className="flex flex-col gap-1 text-sm">
                        {last.counts.map((v) => (
                          <li key={v.id} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 truncate">{label(v.id)}</span>
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${(v.n / last.active) * 100}%` }} />
                            </span>
                            <span className="w-16 shrink-0 text-right tabular-nums">
                              {v.n} {v.n === 1 ? "vote" : "votes"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {words.length > 0 && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">How the count went</summary>
                      <ol className="mt-1 flex flex-col gap-1">
                        {words.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ol>
                    </details>
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
              const ranking = mine[k] ?? []
              return (
                <Card key={k}>
                  <CardContent className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{def?.label ?? k}</h3>
                      {ranking.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-pos">
                          <Check aria-hidden className="size-3.5" /> Voted
                        </span>
                      )}
                    </div>
                    {def && <p className="text-sm text-muted-foreground">{def.description}</p>}
                    {k === "mip-season" && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted-foreground">What the numbers say</summary>
                        <div className="mt-2">
                          <ImprovingCard state={state} limit={3} />
                        </div>
                      </details>
                    )}
                    {def?.kind === "duo" ? (
                      <DuoBallot candidates={b.candidates.filter((id) => id !== me)} ranking={ranking} half={half[k] ?? null} name={name} onTap={(id) => tapDuo(k, id)} onRemove={(pair) => void save(k, ranking.filter((x) => x !== pair))} />
                    ) : (
                      <>
                        <div role="group" aria-label={`Rank players for ${def?.label ?? k}`} className="flex flex-wrap gap-2">
                          {b.candidates
                            .filter((id) => id !== me)
                            .sort((x, y) => name(x).localeCompare(name(y)))
                            .map((id) => {
                              const place = ranking.indexOf(id)
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  aria-pressed={place >= 0}
                                  aria-label={place >= 0 ? `${name(id)}, ranked ${place + 1}. Tap to take out.` : `Rank ${name(id)} next`}
                                  onClick={() => tap(k, id)}
                                  className={cn(
                                    "flex min-h-10 items-center gap-2 rounded-full border px-3 py-1 text-sm",
                                    place >= 0 ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/60",
                                  )}
                                >
                                  {place >= 0 && (
                                    <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary-foreground text-xs font-bold text-primary">
                                      {place + 1}
                                    </span>
                                  )}
                                  {name(id)}
                                </button>
                              )
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {ranking.length
                            ? `Your order: ${ranking.map((id, i) => `${i + 1}. ${name(id)}`).join("  ")}${def?.kind === "teams" && ranking.length < 6 ? `. Rank ${6 - ranking.length} more to fill both teams.` : ""}`
                            : "Tap players in order: your first choice, then your second, and so on."}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
          {problem && <p className="text-sm text-destructive">{problem}</p>}
          {me && <p className="text-xs text-muted-foreground">Rank as many as you like. Tap a ranked player (or the x on a pair) to take them out. You can change your ballot until voting closes, and nobody sees it.</p>}
        </section>
      )}
      <PastAwards state={state} />
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

// A duo ballot: tap two players to make a pair, which is ranked next; ranked pairs are listed with a button to take each out.
function DuoBallot({ candidates, ranking, half, name, onTap, onRemove }: { candidates: string[]; ranking: string[]; half: string | null; name: (id: string) => string; onTap: (id: string) => void; onRemove: (pair: string) => void }) {
  return (
    <>
      <div role="group" aria-label="Pick two players to make a pair" className="flex flex-wrap gap-2">
        {[...candidates]
          .sort((x, y) => name(x).localeCompare(name(y)))
          .map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={half === id}
              onClick={() => onTap(id)}
              className={cn("min-h-10 rounded-full border px-3 py-1 text-sm", half === id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/60")}
            >
              {name(id)}
            </button>
          ))}
      </div>
      <p className="text-xs text-muted-foreground">{half ? `Now pick ${name(half)}'s partner.` : ranking.length ? "Pick two more to rank another pair." : "Pick two players to make your first pair."}</p>
      {ranking.length > 0 && (
        <ol className="flex flex-col gap-1">
          {ranking.map((pair, i) => (
            <li key={pair} className="flex items-center gap-2 text-sm">
              <span aria-hidden className="grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="flex-1">{pairOf(pair).map(name).join(" and ")}</span>
              <button type="button" aria-label={`Take out ${pairOf(pair).map(name).join(" and ")}`} className="min-h-9 px-2 text-muted-foreground hover:text-foreground" onClick={() => onRemove(pair)}>
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}

// The teams vote revealed: places 1 to 3 are the first team, 4 to 6 the second, each place found by instant runoff with the players
// above it taken off every ballot (`places`).
function TeamsResult({ title, description, ballots, name, latest }: { title: string; description: string; ballots: string[][]; name: (id: string) => string; latest: boolean }) {
  const order = places(ballots)
  const flat = order.flat()
  const team = (ids: string[], label: string) =>
    ids.length > 0 && (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex flex-wrap gap-3">
          {ids.map((id) => (
            <span key={id} className="flex items-center gap-2">
              <PlayerAvatar id={id} name={name(id)} />
              <span className="font-display text-xl font-bold">{name(id)}</span>
            </span>
          ))}
        </div>
      </div>
    )
  return (
    <Card className={cn(latest && "ring-2 ring-gold/60")}>
      <CardContent className="flex flex-col gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {flat.length ? (
          <>
            {team(flat.slice(0, 3), "First Team")}
            {team(flat.slice(3, 6), "Second Team")}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">How the count went</summary>
              <p className="mt-1 text-xs text-muted-foreground">Each place is its own ranked-choice count, with the players already placed taken off every ballot.</p>
              <ol className="mt-1 flex flex-col gap-0.5">
                {order.map((ids, i) => (
                  <li key={ids.join("|")}>
                    Place {order.slice(0, i).flat().length + 1}: {ids.map(name).join(" and ")}
                    {ids.length > 1 ? " (tied)" : ""}
                  </li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nobody voted for this one.</p>
        )}
      </CardContent>
    </Card>
  )
}
