import { Rocket, Target } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { IdentityPrompt } from "@/components/WhoAmI"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { myPlayerId, useWho } from "@/lib/identity"
import { isOffseason } from "@/lib/offseason"
import { ordinalOf } from "@/lib/ordinal"
import { playerName } from "@/lib/players"
import { actualResults, AWARD_PICKS, duoKey, JUMP_POINTS, JUMP_SPOTS, jumpPicks, loadAllPredictions, MAX_JUMPS, priorSeason, savePrediction, scorePredictions, type Entry, type Picks } from "@/lib/predictions"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

// Everyone's preseason entries for the season that starts on opening night. The hub loads them once and hands them to
// its list and both cards, so saved picks show in the group's list at once. Both cards write the same row per
// person, and each save keeps whatever the other card already saved.
export function usePredictions(state: PooleanState) {
  const client = getClient()
  const season = state.openingNight?.date
  const who = useWho()
  const me = myPlayerId(who, state.players)
  // One read of every season's rows: this season's entries, plus the past seasons, which scoring needs.
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

// Before opening night everyone names up to three players they think will make a jump. The group's picks show in the hub.
export function JumpPicksCard({ state, p }: { state: PooleanState; p: PredictionsData }) {
  const { client, season, me, entries, mine, save, open } = p
  const [picked, setPicked] = useState<string[]>([])
  const [status, setStatus] = useState("")
  // Keyed on the contents: the data refreshes every minute, and that must not undo half-made picks.
  const savedKey = (mine?.picks.jumps ?? []).join(",")
  useEffect(() => {
    setPicked(savedKey ? savedKey.split(",") : [])
  }, [savedKey])
  if (!client || !season || !open) return null
  const roster = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  const toggle = (id: string) => {
    setStatus("")
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < MAX_JUMPS ? [...cur, id] : cur))
  }
  const submit = async () => {
    setStatus("Saving")
    setStatus((await save({ jumps: picked })) ? "Saved" : SAVE_FAILED)
  }
  const inSoFar = entries.filter((e) => (e.picks.jumps ?? []).length > 0).length
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Pick who makes a jump">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <Rocket aria-hidden className="size-4 text-accent" /> Who makes a jump?
      </h3>
      <p className="text-sm text-muted-foreground">
        Pick up to {MAX_JUMPS} players you think will make a jump next season. A pick scores {JUMP_POINTS} points if they finish at least {JUMP_SPOTS} spots higher in the Standings than last season, among players ranked in both. {inSoFar} {inSoFar === 1 ? "person" : "people"} in so far.
      </p>
      {!me ? (
        <IdentityPrompt state={state} text="Who are you? Pick yourself to make your picks." />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {roster.map((x) => {
              const on = picked.includes(x.id)
              return (
                <button key={x.id} type="button" aria-pressed={on} disabled={!on && picked.length >= MAX_JUMPS} onClick={() => toggle(x.id)} className={cn("flex min-h-10 items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-3 text-sm disabled:opacity-40", on && "border-primary bg-primary text-primary-foreground")}>
                  <PlayerAvatar id={x.id} name={x.name} size="sm" />
                  {x.name}
                </button>
              )
            })}
          </div>
          <Button className="self-start" onClick={() => void submit()}>
            {mine?.picks.jumps?.length ? "Update my picks" : "Lock in my picks"}
          </Button>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
      )}
    </section>
  )
}

// Before opening night: call the award winners and the top three. After it: everyone's picks, scored live.
export function PredictionsCard({ state, p }: { state: PooleanState; p: PredictionsData }) {
  const { client, season, me, all, entries, mine, save, open } = p
  const [draft, setDraft] = useState<Picks>({})
  const [duo, setDuo] = useState<[string, string]>(["", ""])
  const [status, setStatus] = useState("")
  useEffect(() => {
    if (!mine) return
    setDraft(mine.picks)
    const [a = "", b = ""] = (mine.picks.duo ?? "").split("|")
    setDuo([a, b])
  }, [mine])
  const actual = useMemo(() => (season && !open ? actualResults(state, season, undefined, priorSeason(all.map((e) => e.season), season)) : null), [state, season, open, all])
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
            Call the award winners and the top three by two-way per 25 (the Standings order, at least 3 games) before opening night. Awards are worth 2 points, a top three spot 3 if exact and 1 if in the wrong spot. Jump picks score on top of these. {entries.filter((e) => e.picks.mvp || (e.picks.top3 ?? []).length).length} in so far.
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
                <PlayerSelect key={i} state={state} value={top[i] || undefined} onChange={(v) => setTop(i, v)} label={`Top 3 by two-way/25, ${ordinalOf(i + 1)}`} taken={top} />
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
            <JumpsSoFar state={state} entries={entries} jumps={actual.jumps} />
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

// Who was picked to make a jump, and who is making one so far.
function JumpsSoFar({ state, entries, jumps }: { state: PooleanState; entries: Entry[]; jumps: string[] }) {
  const picks = jumpPicks(entries)
  if (picks.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5 border-t pt-3">
      <h4 className="text-sm font-semibold">Picked to make a jump</h4>
      <p className="text-xs text-muted-foreground">Making one means {JUMP_SPOTS} or more spots higher in the Standings than last season. It changes as the season goes.</p>
      <ul className="flex flex-col gap-1 text-sm">
        {picks.map((r) => (
          <li key={r.id} className="flex justify-between gap-2">
            <span>{playerName(state, r.id)}</span>
            <span className="tabular-nums text-muted-foreground">
              {r.votes} {r.votes === 1 ? "pick" : "picks"}
              {jumps.includes(r.id) ? ", making one" : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
