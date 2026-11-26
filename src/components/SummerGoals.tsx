import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getClient } from "@/lib/cloud"
import { GOALS, goalDef, goalSeason, lastSeason, loadGoals, progress, saveGoal, type Goal, type GoalKind } from "@/lib/goals"
import { myPlayerId, useWho } from "@/lib/identity"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"

// Summer goals on the Player page (src/lib/goals.ts): up to two, set from the player's own phone, with how close they are.
export function SummerGoals({ state, pid }: { state: PooleanState; pid: string }) {
  const client = getClient()
  const who = useWho()
  const mine = myPlayerId(who, state.players) === pid
  const season = goalSeason(state)
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [editing, setEditing] = useState(false)
  const refresh = useCallback(() => {
    if (client) void loadGoals(client, season).then((all) => setGoals(all.filter((g) => g.player === pid)))
  }, [client, season, pid])
  useEffect(refresh, [refresh])
  if (!client || goals === null) return null
  if (!goals.length && !mine) return null
  const name = playerName(state, pid)
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-muted-foreground">
            <Target aria-hidden className="size-4 text-accent" /> {mine ? "Your" : `${name}'s`} goals for summer {season}
          </h2>
          {mine && !editing && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              {goals.length ? "Change" : "Set goals"}
            </Button>
          )}
        </div>
        {!goals.length && !editing && <p className="text-sm text-muted-foreground">Pick up to two things to hit this summer. Everyone can see them on this page.</p>}
        {!editing &&
          [...goals]
            .sort((a, b) => a.slot - b.slot)
            .map((g) => {
              const p = progress(state, g)
              const def = goalDef(g.goal)!
              return (
                <div key={g.slot} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{def.label(g.target)}</span>
                    {p.done && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <Check aria-hidden className="size-3.5" /> Done
                      </span>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.share * 100)} aria-label={def.label(g.target)}>
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.round(p.share * 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{p.text}</span>
                </div>
              )
            })}
        {editing && <Editor state={state} pid={pid} season={season} goals={goals} onDone={() => (setEditing(false), refresh())} />}
      </CardContent>
    </Card>
  )
}

function Editor({ state, pid, season, goals, onDone }: { state: PooleanState; pid: string; season: string; goals: Goal[]; onDone: () => void }) {
  const client = getClient()!
  const start = (slot: 1 | 2) => {
    const g = goals.find((x) => x.slot === slot)
    return { kind: (g?.goal ?? "") as GoalKind | "", target: g ? String(g.target) : "" }
  }
  const [rows, setRows] = useState([start(1), start(2)])
  const [msg, setMsg] = useState("")
  const [busy, setBusy] = useState(false)
  const hints = useMemo(
    () =>
      rows.map((r) => {
        if (!r.kind) return ""
        const v = lastSeason(state, r.kind, pid, season)
        const def = goalDef(r.kind)!
        return v === null ? "" : `Last summer: ${def.pct ? `${Math.round(v)}%` : Number.isInteger(v) ? v : v.toFixed(1)}`
      }),
    [rows, state, pid, season],
  )
  const save = async () => {
    setBusy(true)
    let ok = true
    for (const [i, r] of rows.entries()) {
      const slot = (i + 1) as 1 | 2
      const t = Number(r.target)
      const had = goals.some((g) => g.slot === slot)
      if (r.kind && r.target !== "" && Number.isFinite(t) && t >= 0) ok = (await saveGoal(client, season, pid, slot, r.kind, t)) && ok
      else if (had) ok = (await saveGoal(client, season, pid, slot, null, null)) && ok
    }
    setBusy(false)
    if (ok) onDone()
    else setMsg("Those goals belong to another phone, so they can only be changed from it.")
  }
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Goal ${i + 1}`}
              value={r.kind}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as GoalKind | "" } : x)))}
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">{i === 0 ? "Pick a goal" : "No second goal"}</option>
              {GOALS.map((g) => (
                <option key={g.kind} value={g.kind}>
                  {g.name}
                </option>
              ))}
            </select>
            <Input
              aria-label={`Target for goal ${i + 1}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={r.kind ? goalDef(r.kind)!.step : 1}
              placeholder="Target"
              value={r.target}
              disabled={!r.kind}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))}
              className="w-24"
            />
          </div>
          {hints[i] && <span className="text-xs text-muted-foreground">{hints[i]}</span>}
        </div>
      ))}
      {msg && <p className="text-sm text-destructive">{msg}</p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => void save()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
