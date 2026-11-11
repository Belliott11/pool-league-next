import { useMemo } from "react"
import { Panel } from "@/components/Panel"
import { BANDS, fatigue, LOW_SAMPLE, type Band } from "@/lib/dayLoad"
import type { PooleanState } from "@/lib/types"
import { Grid, Hint, Who } from "./parts"

const text = (b: Band) => (b.w + b.l === 0 ? "-" : `${b.w}-${b.l} (${Math.round((b.w / (b.w + b.l)) * 100)}%)`)
const low = (b: Band) => b.w + b.l < LOW_SAMPLE

// Win-loss results grouped by how many games a player had already played that day, each player and everyone together.
export function FatiguePanel({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => fatigue(state), [state])
  if (rows.length === 0) return null
  return (
    <Panel title="Fatigue" hint="Results by how many games a player had already played that day. It counts every old-site result, so games that were never filmed are in, and it needs no tagging.">
      <Grid
        min="34rem"
        head={["Player", ...BANDS.map((b) => b.label)]}
        rows={rows.map((r) => ({
          key: r.id || "all",
          cells: [
            r.id === "" ? <span key="n" className="font-medium">Everyone</span> : <Who key="n" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />,
            ...BANDS.map((b) => {
              const v = r.bands[b.key]
              return (
                <span key={b.key} className={low(v) ? "text-muted-foreground" : "font-medium"} title={low(v) && v.w + v.l > 0 ? `Only ${v.w + v.l} games, so this is a small sample` : undefined}>
                  {text(v)}
                  {low(v) && v.w + v.l > 0 && <span className="text-xs"> {v.w + v.l}g</span>}
                </span>
              )
            }),
          ],
        }))}
      />
      <Hint>Grey and a small count means fewer than {LOW_SAMPLE} games in that group. Players on the winning side tend to play more games in a row, so this can flatter the later groups.</Hint>
    </Panel>
  )
}
