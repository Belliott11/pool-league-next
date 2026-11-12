import { SeasonSwitch } from "@/components/SeasonSwitch"
import { seasonView } from "@/lib/season"
import { AdvancedReads } from "./leaderboard/AdvancedReads"
import { useMemo } from "react"
import { Section } from "@/components/Section"
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

// Same six groups, in the same order, as the classic Leaderboard tab.
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
  { title: "Two-Way Ranking", group: "Top of the page", sectionId: null, hint: "Every player ranked by Two-Way/25" },
  { title: "Season Rates (Individual)", group: "Top of the page", sectionId: null, hint: "The full stat table" },
  ...[...(TABLE_PANELS as { title: string; section: string }[]), ...(MOUNT_PANELS as { title: string; section: string }[])]
    .filter((p) => !LEADERBOARD_DROP.has(p.title) && !placeOf(p.title, LEADERBOARD_GROUPS)?.editorOnly)
    .map((p) => {
      const g = placeOf(p.title, LEADERBOARD_GROUPS)
      return { title: p.title, group: g ? `${sectionTitle(g.home)}, ${g.title}` : sectionTitle(p.section), sectionId: `lb-section-${g ? g.home : p.section}`, hint: HINTS[p.title]?.hint }
    }),
]

// Phones only: one row of chips pinned under the header, so the long page is a jump away instead of a scroll.
// The big dropdowns, most to least important. The first two cards sit above these, always.
const ORDER = ["comparison", "reads", "insight", "shooting", "defense", "matchups", "deep", "situational", "flow", "media", "style"] as const
const NATIVE = { reads: { id: "lb-reads", label: "Advanced reads" }, insight: { id: "lb-insight", label: "What decided games" }, deep: { id: "lb-deep", label: "Player deep dive" }, flow: { id: "lb-flow", label: "Game flow" } } as const
const NAV = [
  { id: "lb-ranking", label: "Ranking" },
  { id: "lb-rates", label: "Season rates" },
  ...ORDER.map((k) => (k in NATIVE ? NATIVE[k as keyof typeof NATIVE] : { id: `lb-section-${k}`, label: sectionTitle(k) })),
]

function QuickNav() {
  const readOnly = useReadOnly()
  const go = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })
  }
  return (
    <nav aria-label="Jump to a part of the leaderboard" data-no-swipe className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background/90 px-4 py-2 backdrop-blur sm:hidden">
      {NAV.filter((n) => !(readOnly && EDITOR_ONLY.has(n.id.replace("lb-section-", "")))).map((n, i) => (
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
  // Panels about how players are doing now follow the season start; league-wide ones get every game (see season.ts).
  const season = useMemo(() => seasonView(state, toggles.pastSeasons), [state, toggles.pastSeasons])
  const readOnly = useReadOnly()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PanelSearch items={JUMP_ITEMS} placeholder="Jump to a panel, such as heatmap or turnovers (press /)" />
        </div>
        <StatLegend />
      </div>
      <QuickNav />
      <SeasonSwitch state={state} toggles={toggles} setToggles={setToggles} />
      <div id="lb-ranking" className="anim-rise scroll-mt-28" style={{ "--i": 0 } as React.CSSProperties}>
        <LaneBars onOpenPlayer={onOpenPlayer} />
      </div>
      <div id="lb-rates" className="anim-rise scroll-mt-28" style={{ "--i": 1 } as React.CSSProperties}>
        <SeasonRates state={state} toggles={toggles} setToggles={setToggles} onOpenPlayer={onOpenPlayer} />
      </div>
      {ORDER.filter((k) => !(readOnly && EDITOR_ONLY.has(k))).map((k, i) => {
        const style = { "--i": i + 2 } as React.CSSProperties
        if (k === "reads") return <div key={k} className="anim-rise scroll-mt-28" style={style}><AdvancedReads state={season} all={state} onOpenPlayer={onOpenPlayer} /></div>
        if (k === "insight") return <div key={k} className="anim-rise scroll-mt-28" style={style}><InsightCard state={season} onOpenPlayer={onOpenPlayer} /></div>
        if (k === "deep") return <div key={k} className="anim-rise scroll-mt-28" style={style}><DeepDiveCard state={state} season={season} onOpenPlayer={onOpenPlayer} /></div>
        if (k === "flow") return <div key={k} className="anim-rise scroll-mt-28" style={style}><GameFlowCard state={season} onOpenPlayer={onOpenPlayer} /></div>
        return (
          <div key={k} className="anim-rise" style={style}>
            <Section id={`lb-section-${k}`} title={sectionTitle(k)} icon={sectionIcon(k)} teaser={k === "defense" ? DEFENSE_TEASER : (teasers[k] ?? "")}>
              <LegacyPanels state={season} section={k} onOpenPlayer={onOpenPlayer} version={version} />
              {k === "situational" && <FatiguePanel state={state} onOpenPlayer={onOpenPlayer} />}
            </Section>
          </div>
        )
      })}
    </div>
  )
}
