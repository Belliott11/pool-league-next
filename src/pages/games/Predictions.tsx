import { ChevronDown, ChevronUp, GripVertical, ListOrdered, Target } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { IdentityPrompt } from "@/components/WhoAmI"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { myPlayerId, useWho } from "@/lib/identity"
import { ballotPool, isOffseason } from "@/lib/offseason"
import { ordinalOf } from "@/lib/ordinal"
import { playerName } from "@/lib/players"
import { actualOrder, actualResults, AWARD_PICKS, ballotFor, biggestMisses, duoKey, loadAllPredictions, pastSeasons, savePrediction, scoreBallots, scorePredictions, type Entry, type Picks } from "@/lib/predictions"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Everyone's preseason entries for the season that starts on opening night. The hub loads them once and hands them to
// its list and both cards, so a saved ballot shows in the group ranking at once. Both cards write the same row per
// person, and each save keeps whatever the other card already saved.
export function usePredictions(state: PooleanState) {
  const client = getClient()
  const season = state.openingNight?.date
  const who = useWho()
  const me = myPlayerId(who, state.players)
  // One read of every season's rows: this season's entries, plus the past seasons for "last season's best ballot".
  const [all, setAll] = useState<(Entry & { season: string })[]>([])
  const refresh = useCallback(() => {
    if (client) void loadAllPredictions(client).then(setAll)
  }, [client])
  useEffect(() => {
    refresh()
  }, [refresh])
  const entries: Entry[] = useMemo(() => all.filter((e) => e.season === season), [all, season])
  const mine = entries.find((e) => e.voter === me)
  const save = async (patch: Picks) => {
    if (!client || !season || !me) return false
    const ok = await savePrediction(client, season, me, { ...(mine?.picks ?? {}), ...patch })
    refresh()
    return ok
  }
  return { client, season, me, all, entries, mine, save, open: isOffseason(state) }
}
export type PredictionsData = ReturnType<typeof usePredictions>

const SAVE_FAILED = "Could not save. Has the predictions table been set up?"

function PlayerSelect({ state, value, onChange, label, taken = [] }: { state: PooleanState; value?: string; onChange: (v: string) => void; label: string; taken?: string[] }) {
  const roster = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select className="h-10 w-40 rounded-md border bg-background px-2" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">Pick</option>
        {roster.map((p) => (
          <option key={p.id} value={p.id} disabled={taken.includes(p.id) && p.id !== value}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
}

// Before opening night everyone ranks every player in the app. Drag a row (or use its arrows) to move it. The group's
// combined ranking shows in the hub's way too early list.
export function PowerVoteCard({ state, p }: { state: PooleanState; p: PredictionsData }) {
  const { client, season, me, all, entries, mine, save, open } = p
  const pool = useMemo(() => ballotPool(state), [state])
  const last = useMemo(() => pastSeasons(state, all)[0], [state, all])
  const [ballot, setBallot] = useState<string[]>([])
  const [status, setStatus] = useState("")
  // Keyed on the contents, not the objects: the data refreshes every minute, and that must not undo a half-made ballot.
  const poolKey = pool.join(",")
  const savedKey = (mine?.picks.ranking ?? []).join(",")
  useEffect(() => {
    setBallot(ballotFor(poolKey.split(","), savedKey ? savedKey.split(",") : undefined, poolKey.split(",")))
  }, [poolKey, savedKey])
  const ballots = entries.filter((e) => (e.picks.ranking ?? []).length > 0).length
  if (!client || !season || !open || pool.length < 2) return null
  const submit = async () => {
    setStatus("Saving")
    setStatus((await save({ ranking: ballot })) ? "Saved" : SAVE_FAILED)
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Preseason power ranking vote">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <ListOrdered aria-hidden className="size-4 text-accent" /> Your power ranking
      </h3>
      <p className="text-sm text-muted-foreground">
        Rank all {pool.length} players going into next season. Every ballot goes into the way too early ranking above, as each player's average spot. {ballots} {ballots === 1 ? "ballot" : "ballots"} in.
      </p>
      {last?.ballot && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">
          Last season's closest ballot: <span className="font-semibold">{playerName(state, last.ballot.voter)}</span>, off by {last.ballot.miss.toFixed(1)} spots a player.
        </p>
      )}
      {!me ? (
        <IdentityPrompt state={state} text="Who are you? Pick yourself to vote." />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">It starts in last season's order by the numbers. Drag a row by its handle, or use the arrows.</p>
          <DragBallot state={state} ballot={ballot} setBallot={setBallot} />
          <Button className="self-start" onClick={() => void submit()}>
            {mine?.picks.ranking ? "Update my ballot" : "Send my ballot"}
          </Button>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
      )}
    </section>
  )
}

// The ballot list. Press and drag a row's handle (any part of the row with a mouse) and the row follows the pointer,
// swapping places as it passes the middle of its neighbours. The arrows do the same one step at a time for keyboards.
function DragBallot({ state, ballot, setBallot }: { state: PooleanState; ballot: string[]; setBallot: (f: (cur: string[]) => string[]) => void }) {
  const list = useRef<HTMLOListElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const move = (from: number, to: number) =>
    setBallot((cur) => {
      if (to < 0 || to >= cur.length || from === to) return cur
      const next = [...cur]
      const [id] = next.splice(from, 1)
      next.splice(to, 0, id)
      return next
    })
  const onDown = (e: React.PointerEvent<HTMLLIElement>, id: string) => {
    const t = e.target as Element
    if (t.closest("button")) return
    if (e.pointerType !== "mouse" && !t.closest("[data-handle]")) return
    e.preventDefault()
    // Captured on the list, which never moves, so reordering the rows cannot drop the drag.
    list.current?.setPointerCapture(e.pointerId)
    setDragging(id)
  }
  const onMove = (e: React.PointerEvent<HTMLOListElement>) => {
    if (!dragging || !list.current) return
    const rows = [...list.current.children] as HTMLElement[]
    const from = ballot.indexOf(dragging)
    let to = rows.findIndex((r) => {
      const b = r.getBoundingClientRect()
      return e.clientY < b.top + b.height / 2
    })
    if (to === -1) to = rows.length - 1
    else if (to > from) to -= 1
    if (to !== from) move(from, to)
  }
  const end = () => setDragging(null)
  return (
    <ol ref={list} data-no-swipe onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} className="flex select-none flex-col gap-1" aria-label="Your ballot">
      {ballot.map((id, i) => (
        <li
          key={id}
          onPointerDown={(e) => onDown(e, id)}
          className={cn("flex items-center gap-2 rounded-lg border bg-card px-1 py-1 text-sm transition-shadow", dragging === id ? "relative z-10 shadow-lg ring-2 ring-accent" : "md:cursor-grab")}
        >
          <span data-handle aria-hidden className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground">
            <GripVertical className="size-5" />
          </span>
          <span className="w-6 font-display font-bold tabular-nums text-muted-foreground">{i + 1}</span>
          <PlayerAvatar id={id} name={playerName(state, id)} size="sm" />
          <span className="min-w-0 flex-1 truncate font-medium">{playerName(state, id)}</span>
          <button type="button" className="flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30" disabled={i === 0} aria-label={`Move ${playerName(state, id)} up`} onClick={() => move(i, i - 1)}>
            <ChevronUp aria-hidden className="size-5" />
          </button>
          <button type="button" className="flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30" disabled={i === ballot.length - 1} aria-label={`Move ${playerName(state, id)} down`} onClick={() => move(i, i + 1)}>
            <ChevronDown aria-hidden className="size-5" />
          </button>
        </li>
      ))}
    </ol>
  )
}

// Before opening night: call the award winners and the top three. After it: everyone's picks, scored live.
export function PredictionsCard({ state, p }: { state: PooleanState; p: PredictionsData }) {
  const { client, season, me, entries, mine, save, open } = p
  const [draft, setDraft] = useState<Picks>({})
  const [duo, setDuo] = useState<[string, string]>(["", ""])
  const [status, setStatus] = useState("")
  useEffect(() => {
    if (!mine) return
    setDraft(mine.picks)
    const [a = "", b = ""] = (mine.picks.duo ?? "").split("|")
    setDuo([a, b])
  }, [mine])
  const actual = useMemo(() => (season && !open ? actualResults(state, season) : null), [state, season, open])
  if (!client || !season) return null
  if (!open && entries.length === 0) return null

  const top = draft.top3 ?? []
  const setTop = (i: number, v: string) => setDraft((cur) => ({ ...cur, top3: [0, 1, 2].map((k) => (k === i ? v : (cur.top3 ?? [])[k] ?? "")) }))
  const submit = async () => {
    setStatus("Saving")
    const ok = await save({
      mvp: draft.mvp || undefined,
      dpoy: draft.dpoy || undefined,
      mip: draft.mip || undefined,
      duo: duo[0] && duo[1] && duo[0] !== duo[1] ? duoKey(duo[0], duo[1]) : undefined,
      top3: (draft.top3 ?? []).filter(Boolean),
    })
    setStatus(ok ? "Saved" : SAVE_FAILED)
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Preseason predictions">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <Target aria-hidden className="size-4 text-accent" /> Preseason predictions
      </h3>
      {open ? (
        <>
          <p className="text-sm text-muted-foreground">
            Call the award winners and the top three by two-way per 20 (the Standings order, at least 3 games) before opening night. Awards are worth 2 points, a top three spot 3 if exact and 1 if in the wrong spot. {entries.filter((e) => e.picks.mvp || (e.picks.top3 ?? []).length).length} in so far.
          </p>
          {!me ? (
            <IdentityPrompt state={state} text="Who are you? Pick yourself to make your picks." />
          ) : (
            <div className="flex flex-col gap-2">
              {AWARD_PICKS.map((a) => (
                <PlayerSelect key={a.key} state={state} value={draft[a.key]} onChange={(v) => setDraft((cur) => ({ ...cur, [a.key]: v || undefined }))} label={a.label} />
              ))}
              <PlayerSelect state={state} value={duo[0] || undefined} onChange={(v) => setDuo([v, duo[1]])} label="Best duo" taken={[duo[1]]} />
              <PlayerSelect state={state} value={duo[1] || undefined} onChange={(v) => setDuo([duo[0], v])} label="and" taken={[duo[0]]} />
              {[0, 1, 2].map((i) => (
                <PlayerSelect key={i} state={state} value={top[i] || undefined} onChange={(v) => setTop(i, v)} label={`Top 3 by two-way/20, ${ordinalOf(i + 1)}`} taken={top} />
              ))}
              <Button className="self-start" onClick={() => void submit()}>
                {mine?.picks.mvp || (mine?.picks.top3 ?? []).length ? "Update my picks" : "Save my picks"}
              </Button>
              {status && <p className="text-xs text-muted-foreground">{status}</p>}
            </div>
          )}
        </>
      ) : (
        actual && (
          <>
            <p className="text-sm text-muted-foreground">Scored against the leaders right now. It changes as the season goes.</p>
            <ol className="flex flex-col gap-1 text-sm">
              {scorePredictions(entries, actual).map((r, i) => (
                <li key={r.voter} className="flex justify-between gap-2">
                  <span>
                    {i + 1}. {playerName(state, r.voter)}
                  </span>
                  <span className="font-display font-bold tabular-nums">{r.points} pts</span>
                </li>
              ))}
            </ol>
            <BallotsSoFar state={state} entries={entries} season={season} />
          </>
        )
      )}
    </section>
  )
}

// The scored predictions during the season, for the sidebar.
export function SeasonPredictionsCard({ state }: { state: PooleanState }) {
  const p = usePredictions(state)
  return <PredictionsCard state={state} p={p} />
}

// How each preseason power ranking ballot is holding up against the standings, and who the group got most wrong.
function BallotsSoFar({ state, entries, season }: { state: PooleanState; entries: Entry[]; season: string }) {
  const order = useMemo(() => actualOrder(state, season), [state, season])
  const scored = scoreBallots(entries, order)
  if (scored.length === 0) return null
  const { overrated, underrated } = biggestMisses(entries, order)
  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <h4 className="text-sm font-semibold">Power ranking ballots so far</h4>
      <p className="text-xs text-muted-foreground">Average spots each ballot misses a player by, against the Standings. Lowest is closest.</p>
      <ol className="flex flex-col gap-1 text-sm">
        {scored.map((r, i) => (
          <li key={r.voter} className="flex justify-between gap-2">
            <span>
              {i + 1}. {playerName(state, r.voter)}
            </span>
            <span className="tabular-nums text-muted-foreground">off by {r.miss.toFixed(1)}</span>
          </li>
        ))}
      </ol>
      {overrated && (
        <p className="text-xs">
          Most overrated: <span className="font-semibold">{playerName(state, overrated.id)}</span>, ranked {overrated.gap.toFixed(1)} spots higher than they are.
        </p>
      )}
      {underrated && (
        <p className="text-xs">
          Most underrated: <span className="font-semibold">{playerName(state, underrated.id)}</span>, {underrated.gap.toFixed(1)} spots better than the group thought.
        </p>
      )}
    </div>
  )
}
