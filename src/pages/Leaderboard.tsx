import { useMemo } from "react"
import { Section } from "@/components/Section"
import { sectionIcon } from "@/lib/panelIcons"
import { syncLegacy } from "@/lib/legacy"
import type { Toggles } from "@/lib/toggles"
import { computeLeaderboardSectionTeasers } from "@/lib/legacy-core"
import type { PooleanState } from "@/lib/types"
import hints from "@/data/panel-hints.json"
import { MOUNT_PANELS, TABLE_PANELS } from "@/lib/legacy-core"
import { PanelSearch, type JumpItem } from "@/components/PanelSearch"
import { LegacyPanels } from "./leaderboard/LegacyTablePanels"
import { LaneBars } from "./leaderboard/LaneBars"
import { SeasonRates } from "./leaderboard/SeasonRates"

// Same six groups, in the same order, as the classic Leaderboard tab.
const SECTIONS: { key: string; title: string }[] = [
  { key: "comparison", title: "Comparison & Trends" },
  { key: "shooting", title: "Shooting" },
  { key: "matchups", title: "Matchups & Team" },
  { key: "situational", title: "Situational" },
  { key: "style", title: "Play Style & Models" },
  { key: "media", title: "History & Media" },
]

const HINTS = hints as Record<string, { hint: string }>
const sectionTitle = (key: string) => SECTIONS.find((s) => s.key === key)?.title ?? key
const JUMP_ITEMS: JumpItem[] = [
  { title: "Two-Way Ranking", group: "Top of the page", sectionId: null, hint: "Every player ranked by Two-Way/20" },
  { title: "Season Rates (Individual)", group: "Top of the page", sectionId: null, hint: "The full stat table" },
  ...[...(TABLE_PANELS as { title: string; section: string }[]), ...(MOUNT_PANELS as { title: string; section: string }[])].map((p) => ({
    title: p.title,
    group: sectionTitle(p.section),
    sectionId: `lb-section-${p.section}`,
    hint: HINTS[p.title]?.hint,
  })),
]

// Phones only: one row of chips pinned under the header, so the long page is a jump away instead of a scroll.
const NAV = [
  { id: "lb-ranking", label: "Ranking" },
  { id: "lb-rates", label: "Season rates" },
  ...SECTIONS.map((s) => ({ id: `lb-section-${s.key}`, label: s.title })),
]

function QuickNav() {
  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  }
  return (
    <nav aria-label="Jump to a part of the leaderboard" data-no-swipe className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur sm:hidden">
      {NAV.map((n, i) => (
        <button key={n.id} type="button" onClick={() => go(n.id)} style={{ "--i": i } as React.CSSProperties} className="anim-chip shrink-0 rounded-full border bg-card px-3 py-1.5 text-sm font-medium">
          {n.label}
        </button>
      ))}
    </nav>
  )
}

export function LeaderboardPage({
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
  // The classic compute layer keeps its own copy of the state; refresh it before anything renders.
  const version = useMemo(() => {
    syncLegacy(state, toggles)
    return { state, toggles }
  }, [state, toggles])
  const teasers = computeLeaderboardSectionTeasers() as Record<string, string>
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PanelSearch items={JUMP_ITEMS} placeholder="Jump to a panel, such as heatmap or turnovers (press /)" />
      <QuickNav />
      <div id="lb-ranking" className="anim-rise scroll-mt-28" style={{ "--i": 0 } as React.CSSProperties}>
        <LaneBars onOpenPlayer={onOpenPlayer} />
      </div>
      <div id="lb-rates" className="anim-rise scroll-mt-28" style={{ "--i": 1 } as React.CSSProperties}>
        <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
      </div>
      {SECTIONS.map((s, i) => (
        <div key={s.key} className="anim-rise" style={{ "--i": i + 2 } as React.CSSProperties}>
          <Section id={`lb-section-${s.key}`} title={s.title} icon={sectionIcon(s.key)} teaser={teasers[s.key] ?? ""}>
            <LegacyPanels state={state} section={s.key} onOpenPlayer={onOpenPlayer} version={version} />
          </Section>
        </div>
      ))}
    </div>
  )
}
