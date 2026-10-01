/* eslint-disable @typescript-eslint/no-explicit-any */
import { Panel } from "@/components/Panel"
import { PanelBoundary } from "@/components/PanelBoundary"
import { DataTable } from "@/components/DataTable"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import hints from "@/data/panel-hints.json"
import { TABLE_PANELS } from "@/lib/legacy-core"

interface Spec {
  section: string
  order: number
  title: string
  bodyId: string
  columns: { key: string; label: string; accessor: (r: unknown) => unknown; display?: (r: unknown) => string; tooltip?: string }[]
  rows: () => unknown[]
  sort: { key: string; dir: "asc" | "desc" }
  empty: () => string
}

const SPECS = TABLE_PANELS as Spec[]
const HINTS = hints as Record<string, { hint: string; tag?: string }>

// One table panel generated from the classic site's own render function (rows, sort, per-column
// formatting and empty-state text all come from there, so the numbers match exactly).
function LegacyTablePanel({ spec, onOpenPlayer }: { spec: Spec; onOpenPlayer: (id: string) => void }) {
  const rows = spec.rows()
  const meta = HINTS[spec.title]
  return (
    <div data-parity={spec.bodyId}>
      <Panel title={spec.title} hint={meta?.hint} tag={meta?.tag}>
        <DataTable<any>
          columns={spec.columns}
          rows={rows}
          rowKey={(r: { player?: { id: string } }, i?: number) => r.player?.id ?? String(i)}
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

export function LegacyTablePanels({ section, onOpenPlayer }: { section: string; onOpenPlayer: (id: string) => void }) {
  return (
    <>
      {SPECS.filter((s) => s.section === section)
        .sort((a, b) => a.order - b.order)
        .map((s) => (
          <PanelBoundary key={s.bodyId} title={s.title}>
            <LegacyTablePanel spec={s} onOpenPlayer={onOpenPlayer} />
          </PanelBoundary>
        ))}
    </>
  )
}

export function legacyPanelTitles(): string[] {
  return SPECS.map((s) => s.title)
}
