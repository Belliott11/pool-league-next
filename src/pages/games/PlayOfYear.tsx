import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Trophy, Vote } from "lucide-react"
import { ClipTile } from "@/components/ClipTile"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import shares from "@/data/clip-shares.json"
import { clipIdOf } from "@/lib/clipShare"
import { bestClips, gameClips, type Clip } from "@/lib/clips"
import { getClient } from "@/lib/cloud"
import { useReadOnly } from "@/lib/mode"
import { bracket, castPoty, currentBracket, loadPoty, myOwner, newBracket, roundName, type Bracket, type Match, type PotyVote } from "@/lib/playOfYear"
import type { Update } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { PooleanState } from "@/lib/types"

const SHARED = shares as Record<string, { title?: string }>
const titleOf = (id: string | null) => (id ? (SHARED[id]?.title ?? "A play") : "To be decided")

// Every shareable play by its share id, found once.
function useClipsById(state: PooleanState) {
  return useMemo(() => {
    const m = new Map<string, Clip>()
    for (const g of state.games)
      for (const c of gameClips(state, g)) {
        const id = clipIdOf(state, c)
        if (id && !m.has(id)) m.set(id, c)
      }
    return m
  }, [state])
}

// The votes for the newest bracket, refreshed every 15 s while a round is open, and this phone's own.
function usePoty(state: PooleanState) {
  const p = currentBracket(state)
  const client = getClient()
  const [votes, setVotes] = useState<PotyVote[]>([])
  const [me, setMe] = useState("")
  const refresh = useCallback(() => {
    if (client && p) void loadPoty(client, p.id).then(setVotes)
  }, [client, p])
  useEffect(() => {
    void myOwner().then(setMe)
    refresh()
    const t = setInterval(refresh, 15000)
    return () => clearInterval(t)
  }, [refresh])
  const b = useMemo(() => (p ? bracket(p, votes) : null), [p, votes])
  return { p, b, votes, setVotes, me, refresh, client }
}

const left = (d: Date) => {
  const h = Math.max(0, Math.round((d.getTime() - Date.now()) / 3_600_000))
  return h >= 48 ? `${Math.round(h / 24)} days left` : h >= 1 ? `${h} ${h === 1 ? "hour" : "hours"} left` : "closing soon"
}

// The Games home card: the open round and a way in, or last bracket's winner.
export function PotyCard({ state, onOpen }: { state: PooleanState; onOpen: () => void }) {
  const { b, p } = usePoty(state)
  if (!p || !b) return null
  const rounds = b.rounds.length
  if (b.current !== null)
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Trophy aria-hidden className="size-5 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Play of the Year: {roundName(b.current, rounds)}</p>
            <p className="text-xs text-muted-foreground">
              {b.rounds[b.current].length} {b.rounds[b.current].length === 1 ? "matchup" : "matchups"}, {left(b.closesAt(b.current))}. One vote per phone.
            </p>
          </div>
          <Button size="sm" onClick={onOpen}>
            <Vote aria-hidden /> Vote
          </Button>
        </CardContent>
      </Card>
    )
  const closed = b.closesAt(rounds - 1).getTime()
  if (b.champion && Date.now() - closed < 21 * 86_400_000)
    return (
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Trophy aria-hidden className="size-5 text-gold" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">{p.label} Play of the Year:</span> {titleOf(b.champion)}
          </p>
          <Button size="sm" variant="outline" onClick={onOpen}>
            See the bracket
          </Button>
        </CardContent>
      </Card>
    )
  return null
}

function VoteMatch({ state, m, n, of, clips, mine, onVote, showCounts }: { state: PooleanState; m: Match; n: number; of: number; clips: Map<string, Clip>; mine?: string; onVote: (pick: string) => void; showCounts: boolean }) {
  const side = (id: string | null, n: number) => {
    const c = id ? clips.get(id) : null
    const picked = !!id && mine === id
    return (
      <div className={cn("flex min-w-0 flex-col gap-2 rounded-xl border p-2", picked && "border-primary ring-2 ring-primary/40")}>
        {c ? <ClipTile state={state} clip={c} /> : <p className="text-sm font-medium">{titleOf(id)}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" variant={picked ? "default" : "outline"} disabled={!id || !m.open} onClick={() => id && onVote(id)} className="flex-1">
            {picked ? (
              <>
                <Check aria-hidden /> Your vote
              </>
            ) : (
              "Vote for this one"
            )}
          </Button>
          {showCounts && <span className="text-sm tabular-nums text-muted-foreground">{n}</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Matchup {n} of {of}
        {mine && " · voted"}
      </h4>
      <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
        {side(m.a, m.votesA)}
        <span className="text-center font-display text-sm font-bold text-muted-foreground">or</span>
        {side(m.b, m.votesB)}
      </div>
    </div>
  )
}

function BracketList({ b }: { b: Bracket }) {
  return (
    <div className="flex flex-col gap-3">
      {b.rounds.map((ms, r) => (
        <div key={r} className="flex flex-col gap-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {roundName(r, b.rounds.length)}
            {b.current === r && " (voting now)"}
          </h4>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {ms.map((m) => (
              <li key={m.id} className="flex flex-col rounded-lg border px-2.5 py-1.5 text-sm">
                {[m.a, m.b].map((id, i) => (
                  <span key={i} className={cn("flex justify-between gap-2", m.winner && m.winner !== id && "text-muted-foreground line-through decoration-1", !!m.winner && m.winner === id && "font-semibold")}>
                    <span className="truncate">{titleOf(id)}</span>
                    {m.winner && <span className="tabular-nums">{i === 0 ? m.votesA : m.votesB}</span>}
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Start({ state, update }: { state: PooleanState; update: Update }) {
  const seeds = useMemo(() => {
    const out: string[] = []
    for (const c of bestClips(state, { limit: 80, perGame: 4 })) {
      if (c.rough?.length || c.kind === "still") continue
      const id = clipIdOf(state, c)
      if (id && SHARED[id] && !out.includes(id)) out.push(id)
    }
    return out
  }, [state])
  const [label, setLabel] = useState(`Summer ${new Date().getFullYear()}`)
  const size = seeds.length >= 16 ? 16 : seeds.length >= 8 ? 8 : 0
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Start a bracket</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">
          The {size || "best"} best shareable plays, seeded by the same ranking as Top plays (never one that goes badly for someone). Each round is open for 3 days, starting now.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Name</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} className="max-w-xs" />
        </label>
        <Button
          className="self-start"
          disabled={!size || !label.trim()}
          onClick={() => {
            const p = newBracket(seeds, label.trim())
            if (p) update((s) => ({ ...s, playOfYear: [...(s.playOfYear ?? []), p] }))
          }}
        >
          <Trophy aria-hidden /> Start with {size} plays
        </Button>
        {!size && <p className="text-xs text-muted-foreground">Needs at least 8 shareable plays; there are {seeds.length}.</p>}
      </CardContent>
    </Card>
  )
}

export function PlayOfYearPage({ state, update, onBack }: { state: PooleanState; update: Update; onBack: () => void }) {
  const readOnly = useReadOnly()
  const clips = useClipsById(state)
  const { p, b, votes, setVotes, me, refresh, client } = usePoty(state)
  const [refused, setRefused] = useState(false)
  const done = !!b?.champion
  const vote = async (m: Match, pick: string) => {
    if (!client || !p) return
    setVotes((cur) => [...cur.filter((v) => !(v.match === m.id && v.owner === me)), { bracket: p.id, match: m.id, pick, owner: me }])
    const ok = await castPoty(client, p.id, m.id, pick)
    setRefused(!ok)
    refresh()
  }
  const mineFor = (m: Match) => votes.find((v) => v.match === m.id && v.owner === me)?.pick
  return (
    <div className="anim-page flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          &larr; Back to Games
        </Button>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <Trophy aria-hidden className="size-5 text-gold" /> Play of the Year{p ? `: ${p.label}` : ""}
        </h2>
      </div>
      {!p && <p className="text-sm text-muted-foreground">No bracket yet.</p>}
      {b && p && b.champion && (
        <Card>
          <CardContent className="flex flex-col gap-2">
            <p className="font-display text-lg font-bold">The winner: {titleOf(b.champion)}</p>
            {clips.get(b.champion) && <ClipTile state={state} clip={clips.get(b.champion)!} />}
          </CardContent>
        </Card>
      )}
      {b && p && b.current !== null && (
        <section className="flex flex-col gap-3" aria-label="Vote">
          <p className="text-sm text-muted-foreground">
            {roundName(b.current, b.rounds.length)}: pick one play from each pair, {left(b.closesAt(b.current))}. One vote per phone; you can change it until the round closes. The counts show once you have voted.
          </p>
          {refused && <p className="text-sm text-destructive">That vote did not go through. The round may have just closed.</p>}
          {b.rounds[b.current].map((m, i, all) => (
            <VoteMatch key={m.id} state={state} m={m} n={i + 1} of={all.length} clips={clips} mine={mineFor(m)} showCounts={!!mineFor(m)} onVote={(pick) => void vote(m, pick)} />
          ))}
        </section>
      )}
      {b && p && b.current === null && !done && <p className="text-sm text-muted-foreground">The next round opens {b.opensAt(0).getTime() > Date.now() ? b.opensAt(0).toLocaleString() : "soon"}.</p>}
      {b && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">The bracket</CardTitle>
          </CardHeader>
          <CardContent>
            <BracketList b={b} />
          </CardContent>
        </Card>
      )}
      {!readOnly && (!p || done) && <Start state={state} update={update} />}
    </div>
  )
}
