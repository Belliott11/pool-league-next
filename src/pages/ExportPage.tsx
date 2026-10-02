import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { PanelBoundary } from "@/components/PanelBoundary"
import { Section } from "@/components/Section"
import { syncLegacy } from "@/lib/legacy"
import { EXPORT_PANELS, computeExportSectionTeasers } from "@/lib/legacy-core"
import type { Toggles } from "@/lib/toggles"
import type { PooleanState } from "@/lib/types"

interface ExportPanelSpec {
  title: string
  hint: string
  tag: string | null
  open: boolean
  section: string
  order: number
  html: string
  render: () => void
  wires: { id: string; evt: string; handler: (e: Event) => void }[]
}

const PANELS = EXPORT_PANELS as ExportPanelSpec[]

// Same four groups, in the same order, as the classic Export tab.
const SECTIONS: { key: string; title: string }[] = [
  { key: "exportData", title: "Export Data" },
  { key: "review", title: "Review & Backfill" },
  { key: "media", title: "Video & Media" },
  { key: "dataManagement", title: "Data Management" },
]

// Shot Arc Hand-Labeling is a developer tool that needs the extracted video frames from the
// shot-arc folder on the classic site, so it is not offered here.
const SKIPPED = new Set(["Shot Arc Hand-Labeling"])

// One panel drawn by the classic code into the panel's original markup (kept under .legacy, the
// scoped classic stylesheet). The classic tools edit their own copy of the data and announce it
// with an event, which the app turns back into React state.
function ExportPanel({ spec, version }: { spec: ExportPanelSpec; version: unknown }) {
  const [error, setError] = useState<string | null>(null)
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
      console.error(`Export panel "${spec.title}" failed`, e)
      setError(String(e))
    }
  }, [spec, version])
  return (
    <details open={spec.open} className="group rounded-xl border bg-card" data-export-panel={spec.title}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <span className="text-muted-foreground transition-transform group-open:rotate-90">&#9656;</span>
        <h3 className="font-display text-base font-bold">{spec.title}</h3>
        {spec.tag && <Badge variant="secondary">{spec.tag}</Badge>}
      </summary>
      <div className="flex min-w-0 flex-col gap-3 p-4 pt-0">
        {spec.hint && <p className="text-sm text-muted-foreground">{spec.hint}</p>}
        {error && <p className="text-sm text-destructive">This panel hit an error: {error}</p>}
        <div className="legacy" dangerouslySetInnerHTML={{ __html: spec.html }} />
      </div>
    </details>
  )
}

export function ExportPage({ state, toggles }: { state: PooleanState; toggles: Toggles }) {
  const version = useMemo(() => {
    syncLegacy(state, toggles)
    return { state, toggles }
  }, [state, toggles])
  const teasers = computeExportSectionTeasers() as Record<string, string>

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <nav className="flex flex-wrap gap-2" aria-label="Export sections">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
            onClick={() => {
              const el = document.getElementById(`export-section-${s.key}`) as HTMLDetailsElement | null
              if (el) {
                el.open = true
                el.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            }}
          >
            {s.title}
          </button>
        ))}
      </nav>
      {SECTIONS.map((s) => (
        <Section key={s.key} id={`export-section-${s.key}`} title={s.title} teaser={teasers[s.key] ?? ""}>
          {PANELS.filter((p) => p.section === s.key && !SKIPPED.has(p.title))
            .sort((a, b) => a.order - b.order)
            .map((p) => (
              <PanelBoundary key={p.title} title={p.title}>
                <ExportPanel spec={p} version={version} />
              </PanelBoundary>
            ))}
        </Section>
      ))}
    </div>
  )
}
