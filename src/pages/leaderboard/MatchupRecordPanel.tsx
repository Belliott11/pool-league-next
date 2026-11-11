import { useMemo } from "react"
import { matchupRecord } from "@/lib/matchupRecord"
import { trustOf } from "@/lib/trust"
import type { PooleanState } from "@/lib/types"
import { Grid, Hint, TrustChip, Who } from "./parts"

export const MATCHUP_TIP = "How each pairing went: shots the scorer took while this defender was on them, from the shot's own defender tag, or from who the game's matchups say was guarding them when no defender was tagged. Shots off a beaten defender are counted apart, so the make rate shows how the scorer did against a defender who was in position."

const pc = (n: number, d: number) => (d === 0 ? "-" : `${Math.round((n / d) * 100)}% (${n}/${d})`)

export function MatchupRecordPanel({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => matchupRecord(state), [state])
  if (rows.length === 0) return <Hint>No pairings yet. Tag a defender on a shot, or log tip-off matchups in Stat Entry.</Hint>
  return (
    <>
      <Grid
        min="44rem"
        head={["Defender", "Scorer", "Shots", "Make rate in position", "Beat", "Sample"]}
        rows={rows.map((r) => ({
          key: `${r.defenderId}|${r.scorerId}`,
          cells: [
            <Who key="d" state={state} id={r.defenderId} onOpenPlayer={onOpenPlayer} />,
            <Who key="s" state={state} id={r.scorerId} onOpenPlayer={onOpenPlayer} />,
            r.shots,
            pc(r.made, r.held),
            r.beat,
            <TrustChip key="t" t={trustOf(r.shots, "shots")} />,
          ],
        }))}
      />
      <Hint>Games with uneven teams and games stopped early are left out. Pairings built on a handful of shots are noise.</Hint>
    </>
  )
}
