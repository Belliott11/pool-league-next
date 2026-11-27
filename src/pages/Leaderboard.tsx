import { SeasonSwitch } from "@/components/SeasonSwitch"
import { seasonView } from "@/lib/season"
import { AdvancedReads } from "./leaderboard/AdvancedReads"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { PageTabs, TabGroup, useJumpTab } from "@/components/PageTabs"
import { LeagueGlance } from "./leaderboard/LeagueGlance"
import { sectionIcon } from "@/lib/panelIcons"
import { syncLegacy } from "@/lib/legacy"
import type { Toggles } from "@/lib/toggles"
import { computeLeaderboardSectionTeasers } from "@/lib/legacy-core"
import type { PooleanState } from "@/lib/types"
import hints from "@/data/panel-hints.json"
import { MOUNT_PANELS, TABLE_PANELS } from "@/lib/legacy-core"
import { LEADERBOARD_DROP, LEADERBOARD_GROUPS, placeOf } from "@/lib/panelGroups"
import { PanelSearch, type JumpItem } from "@/components/PanelSearch"
import { useReadOnly } from "@/lib/mode"
import { StatLegend } from "@/components/StatLegend"
import { LegacyPanels } from "./leaderboard/LegacyTablePanels"
import { LaneBars } from "./leaderboard/LaneBars"
import { SeasonRates } from "./leaderboard/SeasonRates"
import { GameFlowCard } from "./leaderboard/GameFlowCard"
import { InsightCard } from "./leaderboard/InsightCard"
import { DeepDiveCard } from "./leaderboard/DeepDiveCard"
import { FatiguePanel } from "./leaderboard/FatiguePanel"
import { ThreeWorth } from "@/components/ThreeWorth"
import { PointsAddedCard } from "@/components/PointsAdded"
import { ClutchSquaredCard } from "@/components/ClutchSquared"
import { WinChancePlaysCard } from "@/components/WinChancePlays"
import { FormRatingCard } from "@/components/FormRating"
import { RuleChangeCard } from "@/components/RuleChanges"
import { WeatherCard } from "@/components/WeatherCard"
import { ImprovingCard } from "@/components/Improving"
import { CalibrationCard } from "./leaderboard/CalibrationCard"

// The classic Leaderboard tab's groups. The page shows them in tabs after Overview (TABS below).
const SECTIONS: { key: string; title: string }[] = [
  { key: "comparison", title: "Comparison & Trends" },
  { key: "shooting", title: "Shooting" },
  { key: "defense", title: "Defense" },
  { key: "matchups", title: "Matchups & Team" },
  { key: "situational", title: "Situational" },
  { key: "media", title: "History & Media" },
  { key: "style", title: "Play Style & Models" },
]

// Models are developer views, so the section is for editors only.
const EDITOR_ONLY = new Set(["style"])
const DEFENSE_TEASER = "Who defends well, who gets beat, and how hard the shots they face are"
const HINTS = hints as Record<string, { hint: string }>
const sectionTitle = (key: string) => SECTIONS.find((s) => s.key === key)?.title ?? key
const JUMP_ITEMS: JumpItem[] = [
  { title: "Two-Way Ranking", group: "Top of the page", sectionId: "lb-section-overview", hint: "Every player ranked by Two-Way/G" },
  { title: "Season Rates (Individual)", group: "Top of the page", sectionId: "lb-section-overview", hint: "The full stat table" },
  ...[...(TABLE_PANELS as { title: string; section: string }[]), ...(MOUNT_PANELS as { title: string; section: string }[])]
    .filter((p) => !LEADERBOARD_DROP.has(p.title) && !placeOf(p.title, LEADERBOARD_GROUPS)?.editorOnly)
    .map((p) => {
      const g = placeOf(p.title, LEADERBOARD_GROUPS)
      return { title: p.title, group: g ? `${sectionTitle(g.home)}, ${g.title}` : sectionTitle(p.section), sectionId: `lb-section-${g ? g.home : p.section}`, hint: HINTS[p.title]?.hint }
    }),
]

// The page's tabs, each holding the groups listed (in this order). Models are for editors only.
const TABS: { key: string; title: string; groups: string[] }[] = [
  { key: "overview", title: "Overview", groups: [] },
  { key: "shooting", title: "Shooting", groups: ["shooting"] },
  { key: "defense", title: "Defense", groups: ["defense"] },
  { key: "matchups", title: "Matchups", groups: ["matchups"] },
  { key: "trends", title: "Trends", groups: ["comparison", "flow", "situational", "deep"] },
  { key: "history", title: "History", groups: ["media"] },
  { key: "style", title: "Models", groups: ["style"] },
]
const tabOf = (sectionId: string) => (sectionId.startsWith("lb-section-") ? (TABS.find((t) => t.groups.includes(sectionId.slice(11)))?.key ?? "overview") : null)

// A card below the first screen is built when it comes near the screen (or a jump chip asks for it), so opening the page only
// pays for what is in view. Until then it holds its place with an empty box named by `id`, which the jump chips can still find.
function Later({ id, children }: { id: string; children: ReactNode }) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || show) return
    if (typeof IntersectionObserver === "undefined") return setShow(true)
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setShow(true), { rootMargin: "600px" })
    io.observe(el)
    return () => io.disconnect()
  }, [show])
  return show ? <>{children}</> : <div ref={ref} data-later={id} className="h-16 scroll-mt-28 rounded-xl border bg-card" />
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
  // Panels about how players are doing now follow the season start; league-wide ones get every game (see season.ts).
  const season = useMemo(() => seasonView(state, toggles.pastSeasons), [state, toggles.pastSeasons])
  const readOnly = useReadOnly()
  const [tab, setTab] = useJumpTab("overview", tabOf)
  const tabs = TABS.filter((t) => !(readOnly && EDITOR_ONLY.has(t.key)))
  const groups = TABS.find((t) => t.key === tab)?.groups ?? []
  const group = (k: string) => {
    if (k === "flow") return <GameFlowCard key={k} state={season} onOpenPlayer={onOpenPlayer} />
    if (k === "deep") return <DeepDiveCard key={k} state={state} season={season} onOpenPlayer={onOpenPlayer} />
    return (
      <TabGroup key={k} id={`lb-section-${k}`} title={groups.length > 1 ? sectionTitle(k) : null} icon={sectionIcon(k)} teaser={k === "defense" ? DEFENSE_TEASER : (teasers[k] ?? "")}>
        {k === "shooting" && <ThreeWorth state={state} onOpenPlayer={onOpenPlayer} />}
        {k === "comparison" && <RuleChangeCard state={state} />}
        {k === "comparison" && <ImprovingCard state={state} onOpenPlayer={onOpenPlayer} />}
        {k === "comparison" && <WeatherCard state={state} />}
        {k === "style" && <CalibrationCard state={state} />}
        <LegacyPanels state={season} section={k} onOpenPlayer={onOpenPlayer} version={version} />
        {k === "situational" && <FatiguePanel state={state} onOpenPlayer={onOpenPlayer} />}
      </TabGroup>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <LeagueGlance state={state} onOpenPlayer={onOpenPlayer} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PanelSearch items={JUMP_ITEMS} placeholder="Jump to a panel, such as heatmap or turnovers (press /)" />
        </div>
        <StatLegend />
      </div>
      <PageTabs id="lb" label="Leaderboard sections" tabs={tabs} value={tab} onChange={setTab}>
        {tab === "overview" ? (
          <>
            <SeasonSwitch state={state} toggles={toggles} setToggles={setToggles} />
            <div id="lb-ranking" className="scroll-mt-28">
              <LaneBars onOpenPlayer={onOpenPlayer} />
            </div>
            <div id="lb-rates" className="scroll-mt-28">
              <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
            </div>
            <Later id="lb-reads">
              <AdvancedReads state={season} all={state} onOpenPlayer={onOpenPlayer} />
            </Later>
            <Later id="lb-insight">
              <InsightCard state={season} onOpenPlayer={onOpenPlayer} />
            </Later>
            <Later id="lb-epa">
              <PointsAddedCard state={season} onOpenPlayer={onOpenPlayer} />
            </Later>
            <Later id="lb-form">
              <FormRatingCard state={state} onOpenPlayer={onOpenPlayer} />
            </Later>
            <Later id="lb-wpa-plays">
              <WinChancePlaysCard state={season} onOpenPlayer={onOpenPlayer} />
            </Later>
            <Later id="lb-clutch2">
              <ClutchSquaredCard state={season} onOpenPlayer={onOpenPlayer} />
            </Later>
          </>
        ) : (
          groups.map(group)
        )}
      </PageTabs>
    </div>
  )
}
