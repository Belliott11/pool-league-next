import { useMemo } from "react"
import { Section } from "@/components/Section"
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
      <LaneBars onOpenPlayer={onOpenPlayer} />
      <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
      {SECTIONS.map((s) => (
        <Section key={s.key} id={`lb-section-${s.key}`} title={s.title} teaser={teasers[s.key] ?? ""}>
          <LegacyPanels state={state} section={s.key} onOpenPlayer={onOpenPlayer} version={version} />
        </Section>
      ))}
    </div>
  )
}
