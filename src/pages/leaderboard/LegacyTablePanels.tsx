/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from "react"
import { Panel } from "@/components/Panel"
import { PanelGroup } from "@/components/PanelGroup"
import { arrange, LEADERBOARD_DROP, LEADERBOARD_GROUPS } from "@/lib/panelGroups"
import { useReadOnly } from "@/lib/mode"
import { PanelBoundary } from "@/components/PanelBoundary"
import { DataTable } from "@/components/DataTable"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import hints from "@/data/panel-hints.json"
import { BEAT_TIP, BeatRatePanel } from "./BeatRatePanel"
import { AwardsVsStats, PassingChemistryPair, PlayerComparison, PowerRankingVsPerformance } from "./native"
import { LeagueHeatmap, PassingChemistryGrid, TwoWayRankChart } from "./charts2"
import { PlayStyleClusters, ShotMakingAddedChart } from "./charts3"
import { LeagueTsOverTime, TsByZone, TwoWayQuadrant, VolumeEfficiency } from "./charts"
import type { PooleanState } from "@/lib/types"
import { MOUNT_PANELS, TABLE_PANELS } from "@/lib/legacy-core"

interface TableSpec {
  section: string
  order: number
  title: string
  bodyId: string
  columns: { key: string; label: string; accessor: (r: unknown) => unknown; display?: (r: unknown) => string; tooltip?: string }[]
  rows: () => unknown[]
  sort: { key: string; dir: "asc" | "desc" }
  empty: () => string
}

interface MountSpec {
  section: string
  order: number
  title: string
  html: string
  render: () => void
  wires: { id: string; evt: string; handler: (e: Event) => void }[]
}

const TABLES = TABLE_PANELS as TableSpec[]
const MOUNTS = MOUNT_PANELS as MountSpec[]
// Beat Rate is a React panel with no classic markup; it joins the Defense tabs as one more spec.
const BEAT_SPEC = { section: "defense", order: 21, title: "Beat Rate" }
const HINTS = hints as Record<string, { hint: string; tag?: string }>

// One table panel generated from the classic site's own render function (rows, sort, per-column
// formatting and empty-state text all come from there, so the numbers match exactly).
function LegacyTablePanel({ spec, onOpenPlayer, bare }: { spec: TableSpec; onOpenPlayer: (id: string) => void; bare?: boolean }) {
  const rows = spec.rows()
  const meta = HINTS[spec.title]
  const table = (
        <DataTable<any>
          columns={spec.columns}
          rows={rows}
          rowKey={(r: { player?: { id: string } }, i: number) => r.player?.id ?? String(i)}
          defaultSort={spec.sort}
          empty={spec.empty()}
          renderFirst={(r: { player?: { id: string; name: string } }) =>
            r.player ? (
              <button type="button" className="flex items-center gap-2 font-bold text-accent hover:underline" onClick={() => onOpenPlayer(r.player!.id)}>
                <PlayerAvatar id={r.player.id} name={r.player.name} size="sm" />
                {r.player.name}
              </button>
            ) : undefined
          }
        />
  )
  return (
    <div data-parity={spec.bodyId}>
      {bare ? (
        table
      ) : (
        <Panel title={spec.title} hint={meta?.hint} tag={meta?.tag}>
          {table}
        </Panel>
      )}
    </div>
  )
}

// Every other panel is drawn by its classic render function into the panel's original markup.
// The markup sits under .legacy (the classic stylesheet, scoped) and the function re-runs whenever
// the data or a toggle changes.
function LegacyMountPanel({ spec, version, bare }: { spec: MountSpec; version: unknown; bare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const meta = HINTS[spec.title]
  // The classic site wires selects and buttons once at load; do the same once the markup exists.
  useEffect(() => {
    const ctl = new AbortController()
    spec.wires.forEach((w) => document.getElementById(w.id)?.addEventListener(w.evt, w.handler, { signal: ctl.signal }))
    return () => ctl.abort()
  }, [spec])
  useEffect(() => {
    try {
      spec.render()
      setError(null)
    } catch (e) {
      console.error(`Panel "${spec.title}" failed`, e)
      setError(String(e))
    }
  }, [spec, version])
  const inner = (
    <>
      {error && <p className="text-sm text-destructive">This panel hit an error: {error}</p>}
      <div ref={ref} className="legacy" dangerouslySetInnerHTML={{ __html: spec.html }} />
    </>
  )
  return (
    <div data-mount={spec.title}>
      {bare ? (
        inner
      ) : (
        <Panel title={spec.title} hint={meta?.hint} tag={meta?.tag}>
          {inner}
        </Panel>
      )}
    </div>
  )
}

// Panels rebuilt as real React components; they replace the classic markup of the same title.
function nativePanel(title: string, state: PooleanState, open: (id: string) => void) {
  switch (title) {
    case "Player Comparison": return <PlayerComparison state={state} onOpen={open} />
    case "Awards vs. Stats": return <AwardsVsStats onOpen={open} />
    case "Power Ranking vs. Performance": return <PowerRankingVsPerformance onOpen={open} />
    case "Volume vs. Efficiency": return <VolumeEfficiency onOpen={open} />
    case "League TS% Over Time": return <LeagueTsOverTime />
    case "League Shot Heatmap": return <LeagueHeatmap state={state} />
    case "Two-Way/25 Rank Over the Season": return <TwoWayRankChart state={state} />
    case "League Passing Chemistry Grid": return <PassingChemistryGrid onOpen={open} />
    case "Shot-Making Added, Cumulative Over the Season": return <ShotMakingAddedChart state={state} />
    case "Stat Strengths": return <PlayStyleClusters onOpen={open} />
    case "TS% by Shot Distance": return <TsByZone />
    case "Two-Way Quadrant": return <TwoWayQuadrant onOpen={open} />
    case "Passing Chemistry: Pair Detail": return <PassingChemistryPair state={state} />
    default: return null
  }
}

export function LegacyPanels({
  state,
  section,
  onOpenPlayer,
  version,
}: {
  state: PooleanState
  section: string
  onOpenPlayer: (id: string) => void
  version: unknown
}) {
  const readOnly = useReadOnly()
  const layout = useMemo(() => arrange([...TABLES, ...MOUNTS, BEAT_SPEC] as { title: string; section: string; order: number }[], LEADERBOARD_GROUPS, { drop: LEADERBOARD_DROP, editor: !readOnly }), [readOnly])
  const specOf = (title: string) => [...TABLES, ...MOUNTS, BEAT_SPEC].find((s) => s.title === title)!
  // A panel's body without its card, for use as a tab; or the whole card when it stands alone.
  const bodyOf = (title: string, bare: boolean) => {
    if (title === "Beat Rate") return <BeatRatePanel state={state} onOpenPlayer={onOpenPlayer} bare={bare} />
    const s = specOf(title)
    if ("bodyId" in s) return <LegacyTablePanel spec={s as TableSpec} onOpenPlayer={onOpenPlayer} bare={bare} />
    const native = nativePanel(title, state, onOpenPlayer)
    if (native) return bare ? <>{native}</> : <Panel title={title} hint={HINTS[title]?.hint} tag={HINTS[title]?.tag}>{native}</Panel>
    return <LegacyMountPanel spec={s as MountSpec} version={version} bare={bare} />
  }
  return (
    <>
      {(layout.get(section) ?? []).map((p) =>
        p.group ? (
          <PanelBoundary key={p.group.id} title={p.group.title}>
            <PanelGroup
              title={p.group.title}
              section={section}
              frame="card"
              tabs={p.members!.map((m) => ({ title: m.title, label: m.label, hint: HINTS[m.title]?.hint ?? (m.title === "Beat Rate" ? BEAT_TIP : undefined), tag: HINTS[m.title]?.tag, node: () => bodyOf(m.title, true) }))}
            />
          </PanelBoundary>
        ) : (
          <PanelBoundary key={p.item!.title} title={p.item!.title}>
            {bodyOf(p.item!.title, false)}
          </PanelBoundary>
        ),
      )}
    </>
  )
}
