import { useMemo } from "react"
import { Panel } from "@/components/Panel"
import { beatRates, rate, TRANSITION_SECONDS, type BeatRow } from "@/lib/beatRate"
import { trustOf } from "@/lib/trust"
import type { PooleanState } from "@/lib/types"
import { Grid, Hint, TrustChip, Who } from "./parts"

export const BEAT_TIP = `Beat means the defender was beaten right before the shot and was out of the play: not back, out of position, or away from the shot. It is a defensive breakdown, not a measure of the shooter. Transition is a shot within ${TRANSITION_SECONDS} seconds of a turnover or steal.`

const cell = (n: number, d: number) => (d === 0 ? "-" : `${n} of ${d} (${Math.round((n / d) * 100)}%)`)
const oppText = (r: BeatRow) => (r.oppAtt === 0 ? "-" : `${Math.round((r.oppMade / r.oppAtt) * 100)}% (${r.oppMade}/${r.oppAtt})`)
const sortKey = (r: BeatRow) => rate(r.beat, r.faced) ?? -1

// Every defender's Beat Rate, split into transition and half court, with opponent FG% leaving beat shots out so someone who is
// solid when in position reads differently from someone who is burned.
export function BeatRatePanel({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => beatRates(state).filter((r) => r.faced > 0).sort((a, b) => sortKey(b) - sortKey(a) || b.faced - a.faced), [state])
  if (rows.length === 0) return null
  return (
    <Panel title="Beat Rate" hint={BEAT_TIP}>
      <Grid
        min="44rem"
        head={["Defender", "Beat Rate", "Transition", "Half court", "Opp FG% without beat shots", "Sample"]}
        rows={rows.map((r) => ({
          key: r.id,
          cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, <span key="b" title={BEAT_TIP}>{cell(r.beat, r.faced)}</span>, cell(r.tBeat, r.tFaced), cell(r.hBeat, r.hFaced), oppText(r), <TrustChip key="t" t={trustOf(r.faced, "shots")} />],
        }))}
      />
      <Hint>Games with uneven teams and games stopped early are left out. A defender needs about 30 shots faced before this reads as steady.</Hint>
    </Panel>
  )
}

// One player's line for their page.
export function PlayerBeatRate({ state, pid }: { state: PooleanState; pid: string }) {
  const r = useMemo(() => beatRates(state, pid)[0], [state, pid])
  if (!r || r.faced === 0) return null
  const line = (label: string, v: string) => (
    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{v}</span>
    </div>
  )
  return (
    <Panel title="Beat Rate" hint={BEAT_TIP}>
      {line("Beat Rate", cell(r.beat, r.faced))}
      {line("Transition", cell(r.tBeat, r.tFaced))}
      {line("Half court", cell(r.hBeat, r.hFaced))}
      {line("Opp FG% without beat shots", oppText(r))}
      <TrustChip t={trustOf(r.faced, "shots")} />
    </Panel>
  )
}
