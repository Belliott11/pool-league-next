import { Section } from "@/components/Section"
import type { Toggles } from "@/lib/legacy"
import { computeLeaderboardSectionTeasers } from "@/lib/legacy-core"
import type { PooleanState } from "@/lib/types"
import { LegacyTablePanels } from "./leaderboard/LegacyTablePanels"
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
  const teasers = computeLeaderboardSectionTeasers() as Record<string, string>
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
      {SECTIONS.map((s) => (
        <Section key={s.key} id={`lb-section-${s.key}`} title={s.title} teaser={teasers[s.key] ?? ""}>
          <LegacyTablePanels section={s.key} onOpenPlayer={onOpenPlayer} />
        </Section>
      ))}
    </div>
  )
}
