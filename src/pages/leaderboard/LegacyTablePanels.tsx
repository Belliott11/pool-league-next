/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react"
import { Panel } from "@/components/Panel"
import { PanelBoundary } from "@/components/PanelBoundary"
import { DataTable } from "@/components/DataTable"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import hints from "@/data/panel-hints.json"
import { AwardsVsStats, PassingChemistryPair, PlayerComparison, PowerRankingVsPerformance } from "./native"
import { LeagueHeatmap, PassingChemistryGrid, TwoWayRankChart } from "./charts2"
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
const HINTS = hints as Record<string, { hint: string; tag?: string }>

// One table panel generated from the classic site's own render function (rows, sort, per-column
// formatting and empty-state text all come from there, so the numbers match exactly).
function LegacyTablePanel({ spec, onOpenPlayer }: { spec: TableSpec; onOpenPlayer: (id: string) => void }) {
  const rows = spec.rows()
  const meta = HINTS[spec.title]
  return (
    <div data-parity={spec.bodyId}>
      <Panel title={spec.title} hint={meta?.hint} tag={meta?.tag}>
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
      </Panel>
    </div>
  )
}

// Every other panel is drawn by its classic render function into the panel's original markup.
// The markup sits under .legacy (the classic stylesheet, scoped) and the function re-runs whenever
// the data or a toggle changes.
function LegacyMountPanel({ spec, version }: { spec: MountSpec; version: unknown }) {
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
  return (
    <div data-mount={spec.title}>
      <Panel title={spec.title} hint={meta?.hint} tag={meta?.tag}>
        {error && <p className="text-sm text-destructive">This panel hit an error: {error}</p>}
        <div ref={ref} className="legacy" dangerouslySetInnerHTML={{ __html: spec.html }} />
      </Panel>
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
    case "Two-Way/20 Rank Over the Season": return <TwoWayRankChart state={state} />
    case "League Passing Chemistry Grid": return <PassingChemistryGrid onOpen={open} />
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
  const items = [
    ...TABLES.filter((s) => s.section === section).map((s) => ({ order: s.order, node: <LegacyTablePanel spec={s} onOpenPlayer={onOpenPlayer} />, title: s.title })),
    ...MOUNTS.filter((s) => s.section === section).map((s) => {
      const native = nativePanel(s.title, state, onOpenPlayer)
      const meta = HINTS[s.title]
      return {
        order: s.order,
        title: s.title,
        node: native ? (
          <Panel title={s.title} hint={meta?.hint} tag={meta?.tag}>
            {native}
          </Panel>
        ) : (
          <LegacyMountPanel spec={s} version={version} />
        ),
      }
    }),
  ].sort((a, b) => a.order - b.order)
  return (
    <>
      {items.map((it) => (
        <PanelBoundary key={it.title} title={it.title}>
          {it.node}
        </PanelBoundary>
      ))}
    </>
  )
}
