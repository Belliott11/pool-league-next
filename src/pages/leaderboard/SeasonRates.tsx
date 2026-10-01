import { useState } from "react"
import { Panel } from "@/components/Panel"
import { DataTable } from "@/components/DataTable"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { Switch } from "@/components/ui/switch"
import {
  COMPARISON_LOWER_IS_BETTER_KEYS,
  COMPARISON_NEUTRAL_KEYS,
  LEADERBOARD_COLUMNS,
  computeLeaderboard,
} from "@/lib/legacy-core"
import type { Toggles } from "@/lib/legacy"
import type { PooleanState } from "@/lib/types"

const ADVANCED_KEY = "pooleanIntelShowAdvancedCols"
const HIGHLIGHT = {
  neutral: COMPARISON_NEUTRAL_KEYS as Set<string>,
  lowerBetter: COMPARISON_LOWER_IS_BETTER_KEYS as Set<string>,
  skip: new Set(["last5"]),
}

function ToggleRow({ label, checked, disabled, title, onChange }: { label: string; checked: boolean; disabled?: boolean; title?: string; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center justify-between gap-3 text-sm ${disabled ? "opacity-50" : ""}`} title={title}>
      <span>{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

export function SeasonRates({
  state,
  toggles,
  setToggles,
  onOpenPlayer,
}: {
  state: PooleanState
  toggles: Toggles
  setToggles: (t: Toggles) => void
  onOpenPlayer: (id: string) => void
}) {
  const [showAdvanced, setShowAdvanced] = useState(() => localStorage.getItem(ADVANCED_KEY) === "true")
  const columns = LEADERBOARD_COLUMNS.filter((c: { advanced?: boolean }) => !c.advanced || showAdvanced)
  // Players with no games yet would just be a row of dashes.
  const rows = computeLeaderboard().filter((r: { gp: number }) => r.gp > 0)
  const noSeasonClosed = !state.currentSeasonStartedAt

  return (
    <Panel
      title="Season Rates (Individual)"
      hint="Each stat is per 20 combined points, so 16- and 21-point games compare fairly. Only fully logged, even-sided games count. Two-Way is offense plus defense in one number. Click a name for their page, or a column to sort."
    >
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">Filters</summary>
        <div className="mt-3 flex flex-col gap-3">
          <ToggleRow label="Include Imbalanced Games" checked={toggles.imbalanced} onChange={(v) => setToggles({ ...toggles, imbalanced: v })} />
          <ToggleRow
            label="Include Past Seasons"
            checked={toggles.pastSeasons}
            disabled={noSeasonClosed}
            title={noSeasonClosed ? "No season has been closed yet, so nothing is archived to include." : undefined}
            onChange={(v) => setToggles({ ...toggles, pastSeasons: v })}
          />
          <ToggleRow label="Include Outlier Games" checked={toggles.outliers} onChange={(v) => setToggles({ ...toggles, outliers: v })} />
          <ToggleRow
            label="Show Advanced % Columns"
            checked={showAdvanced}
            onChange={(v) => {
              localStorage.setItem(ADVANCED_KEY, String(v))
              setShowAdvanced(v)
            }}
          />
        </div>
      </details>
      <DataTable<any>
        key={showAdvanced ? "adv" : "basic"}
        columns={columns}
        rows={rows}
        rowKey={(r: { player: { id: string } }) => r.player.id}
        defaultSort={{ key: "twoway20", dir: "desc" }}
        highlight={HIGHLIGHT}
        empty="No games with players yet."
        renderFirst={(r: { player: { id: string; name: string } }) => (
          <button type="button" className="flex items-center gap-2 font-bold text-accent hover:underline" onClick={() => onOpenPlayer(r.player.id)}>
            <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
            {r.player.name}
          </button>
        )}
      />
    </Panel>
  )
}
