import { Target } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/cloud"
import { myPlayerId, useWho } from "@/lib/identity"
import { isOffseason } from "@/lib/offseason"
import { playerName } from "@/lib/players"
import { actualResults, AWARD_PICKS, duoKey, loadPredictions, savePrediction, scorePredictions, type Entry, type Picks } from "@/lib/predictions"
import type { PooleanState } from "@/lib/types"

// Before opening night: call the award winners and the top three. After it: everyone's picks, scored live.
export function PredictionsCard({ state }: { state: PooleanState }) {
  const client = getClient()
  const season = state.openingNight?.date
  const who = useWho()
  const me = myPlayerId(who, state.players)
  const open = isOffseason(state)
  const [entries, setEntries] = useState<Entry[]>([])
  const [draft, setDraft] = useState<Picks>({})
  const [duo, setDuo] = useState<[string, string]>(["", ""])
  const [status, setStatus] = useState("")
  const refresh = useCallback(() => {
    if (client && season) void loadPredictions(client, season).then(setEntries)
  }, [client, season])
  useEffect(() => {
    refresh()
  }, [refresh])
  const mine = entries.find((e) => e.voter === me)
  useEffect(() => {
    if (!mine) return
    setDraft(mine.picks)
    const [a = "", b = ""] = (mine.picks.duo ?? "").split("|")
    setDuo([a, b])
  }, [mine])
  const actual = useMemo(() => (season && !open ? actualResults(state, season) : null), [state, season, open])
  if (!client || !season) return null
  if (!open && entries.length === 0) return null

  const roster = [...state.players].sort((a, b) => a.name.localeCompare(b.name))
  const select = (value: string | undefined, onChange: (v: string) => void, label: string) => (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select className="h-10 w-40 rounded-md border bg-background px-2" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">Pick</option>
        {roster.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  )
  const top = draft.top3 ?? []
  const setTop = (i: number, v: string) => setDraft((cur) => ({ ...cur, top3: [0, 1, 2].map((k) => (k === i ? v : (cur.top3 ?? [])[k] ?? "")) }))
  const save = async () => {
    if (!me) return
    const clean: Picks = { mvp: draft.mvp || undefined, dpoy: draft.dpoy || undefined, mip: draft.mip || undefined, duo: duo[0] && duo[1] && duo[0] !== duo[1] ? duoKey(duo[0], duo[1]) : undefined, top3: (draft.top3 ?? []).filter(Boolean) }
    setStatus("Saving")
    setStatus((await savePrediction(client, season, me, clean)) ? "Saved" : "Could not save. Has the predictions table been set up?")
    refresh()
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4" aria-label="Preseason predictions">
      <h3 className="flex items-center gap-2 font-display text-lg font-bold">
        <Target aria-hidden className="size-4 text-accent" /> Preseason predictions
      </h3>
      {open ? (
        <>
          <p className="text-sm text-muted-foreground">
            Call the award winners and the top three before opening night. Awards are worth 2 points, a top three spot 3 if exact and 1 if in the wrong spot. {entries.length} in so far.
          </p>
          {!me ? (
            <p className="text-sm">Say who you are (top right) to make your picks.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {AWARD_PICKS.map((a) => select(draft[a.key], (v) => setDraft((cur) => ({ ...cur, [a.key]: v || undefined })), a.label))}
              {select(duo[0] || undefined, (v) => setDuo([v, duo[1]]), "Best duo")}
              {select(duo[1] || undefined, (v) => setDuo([duo[0], v]), "and")}
              {[0, 1, 2].map((i) => select(top[i] || undefined, (v) => setTop(i, v), `Standings, ${i + 1}${["st", "nd", "rd"][i]}`))}
              <Button className="self-start" onClick={() => void save()}>
                {mine ? "Update my picks" : "Save my picks"}
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
