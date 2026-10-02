import { useMemo } from "react"
import { Section } from "@/components/Section"
import { syncLegacy } from "@/lib/legacy"
import type { Toggles } from "@/lib/toggles"
import { computeLeaderboardSectionTeasers } from "@/lib/legacy-core"
import type { PooleanState } from "@/lib/types"
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
      <LaneBars onOpenPlayer={onOpenPlayer} />
      <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
      {SECTIONS.map((s) => (
        <Section key={s.key} id={`lb-section-${s.key}`} title={s.title} teaser={teasers[s.key] ?? ""}>
          <LegacyPanels section={s.key} onOpenPlayer={onOpenPlayer} version={version} />
        </Section>
      ))}
    </div>
  )
}
