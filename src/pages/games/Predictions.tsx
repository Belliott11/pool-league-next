import { ListOrdered, Target } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { myPlayerId, useWho } from "@/lib/identity"
import { isOffseason } from "@/lib/offseason"
import { ordinalOf } from "@/lib/ordinal"
import { playerName } from "@/lib/players"
import { actualResults, AWARD_PICKS, consensusRanking, duoKey, loadPredictions, RANK_SIZE, savePrediction, scorePredictions, type Entry, type Picks } from "@/lib/predictions"
import type { PooleanState } from "@/lib/types"

// Everyone's preseason entries for the season that starts on opening night. Both cards below read and write the same
// row per person, so each save keeps whatever the other card already saved.
function usePredictions(state: PooleanState) {
  const client = getClient()
  const season = state.openingNight?.date
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const [entries, setEntries] = useState<Entry[]>([])
  const refresh = useCallback(() => {
    if (client && season) void loadPredictions(client, season).then(setEntries)
  }, [client, season])
  useEffect(() => {
    refresh()
  }, [refresh])
  const mine = entries.find((e) => e.voter === me)
  const save = async (patch: Picks) => {
    if (!client || !season || !me) return false
    const ok = await savePrediction(client, season, me, { ...(mine?.picks ?? {}), ...patch })
    refresh()
    return ok
  }
  return { client, season, me, entries, mine, save, open: isOffseason(state) }
}

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

// Before opening night everyone ranks their top 5. The group's ranking adds the ballots up, and it shows to everyone.
export function PowerVoteCard({ state }: { state: PooleanState }) {
  const { client, season, me, entries, mine, save, open } = usePredictions(state)
  const [ballot, setBallot] = useState<string[]>([])
  const [status, setStatus] = useState("")
  useEffect(() => {
    if (mine?.picks.ranking) setBallot(mine.picks.ranking)
  }, [mine])
  const consensus = useMemo(() => consensusRanking(entries), [entries])
  const ballots = entries.filter((e) => (e.picks.ranking ?? []).length > 0).length
  if (!client || !season || !open) return null
  const slots = Math.min(RANK_SIZE, state.players.length)
  const set = (i: number, v: string) => setBallot((cur) => Array.from({ length: slots }, (_, k) => (k === i ? v : (cur[k] ?? ""))))
  const submit = async () => {
    setStatus("Saving")
    setStatus((await save({ ranking: ballot.filter(Boolean) })) ? "Saved" : SAVE_FAILED)
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Preseason power ranking vote">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <ListOrdered aria-hidden className="size-4 text-accent" /> Preseason power ranking
      </h3>
      <p className="text-sm text-muted-foreground">
        Rank your top {slots} going into next season. Each ballot gives {slots} points to 1st down to 1 for {ordinalOf(slots)}. {ballots} {ballots === 1 ? "ballot" : "ballots"} in.
      </p>
      {consensus.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm" aria-label="The group's ranking">
          {consensus.slice(0, 8).map((r, i) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="w-5 font-display font-bold tabular-nums text-muted-foreground">{i + 1}</span>
              <PlayerAvatar id={r.id} name={playerName(state, r.id)} size="sm" />
              <span className="min-w-0 flex-1 truncate font-medium">{playerName(state, r.id)}</span>
              {r.firsts > 0 && <span className="text-xs text-muted-foreground">{r.firsts} first-place</span>}
              <span className="w-12 text-right font-display font-bold tabular-nums">{r.points} pts</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm">No ballots yet. Be the first.</p>
      )}
      {!me ? (
        <p className="text-sm">Say who you are (top right) to vote.</p>
      ) : (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm font-semibold">{mine?.picks.ranking ? "Your ballot" : "Your ballot (not sent yet)"}</p>
          {Array.from({ length: slots }, (_, i) => (
            <PlayerSelect key={i} state={state} value={ballot[i] || undefined} onChange={(v) => set(i, v)} label={ordinalOf(i + 1)} taken={ballot} />
          ))}
          <Button className="self-start" disabled={!ballot.some(Boolean)} onClick={() => void submit()}>
            {mine?.picks.ranking ? "Update my ballot" : "Send my ballot"}
          </Button>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
      )}
    </section>
  )
}

// Before opening night: call the award winners and the top three. After it: everyone's picks, scored live.
export function PredictionsCard({ state }: { state: PooleanState }) {
  const { client, season, me, entries, mine, save, open } = usePredictions(state)
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
            Call the award winners and the top three before opening night. Awards are worth 2 points, a top three spot 3 if exact and 1 if in the wrong spot. {entries.filter((e) => e.picks.mvp || (e.picks.top3 ?? []).length).length} in so far.
          </p>
          {!me ? (
            <p className="text-sm">Say who you are (top right) to make your picks.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {AWARD_PICKS.map((a) => (
                <PlayerSelect key={a.key} state={state} value={draft[a.key]} onChange={(v) => setDraft((cur) => ({ ...cur, [a.key]: v || undefined }))} label={a.label} />
              ))}
              <PlayerSelect state={state} value={duo[0] || undefined} onChange={(v) => setDuo([v, duo[1]])} label="Best duo" taken={[duo[1]]} />
              <PlayerSelect state={state} value={duo[1] || undefined} onChange={(v) => setDuo([duo[0], v])} label="and" taken={[duo[0]]} />
              {[0, 1, 2].map((i) => (
                <PlayerSelect key={i} state={state} value={top[i] || undefined} onChange={(v) => setTop(i, v)} label={`Standings, ${ordinalOf(i + 1)}`} taken={top} />
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
          </>
        )
      )}
    </section>
  )
}
