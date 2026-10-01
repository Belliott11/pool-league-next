/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react"
import { Panel } from "@/components/Panel"
import { PanelBoundary } from "@/components/PanelBoundary"
import { DataTable } from "@/components/DataTable"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import hints from "@/data/panel-hints.json"
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

export function LegacyPanels({
  section,
  onOpenPlayer,
  version,
}: {
  section: string
  onOpenPlayer: (id: string) => void
  version: unknown
}) {
  const items = [
    ...TABLES.filter((s) => s.section === section).map((s) => ({ order: s.order, node: <LegacyTablePanel spec={s} onOpenPlayer={onOpenPlayer} />, title: s.title })),
    ...MOUNTS.filter((s) => s.section === section).map((s) => ({ order: s.order, node: <LegacyMountPanel spec={s} version={version} />, title: s.title })),
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
