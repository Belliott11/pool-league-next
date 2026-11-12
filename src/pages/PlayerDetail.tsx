import { SeasonSwitch } from "@/components/SeasonSwitch"
import { seasonView } from "@/lib/season"
import { Fragment, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { resolvePlayer } from "@/lib/players"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PanelBoundary } from "@/components/PanelBoundary"
import { PanelGroup } from "@/components/PanelGroup"
import { arrange, PLAYER_GROUPS, placeOf } from "@/lib/panelGroups"
import { PlayerHero } from "@/components/PlayerHero"
import { PlayerGameFlow } from "@/pages/PlayerGameFlow"
import { PlayerInsight } from "@/pages/PlayerInsight"
import { PlayerBeatRate } from "@/pages/leaderboard/BeatRatePanel"
import { ScoutingCard } from "@/pages/ScoutingCard"
import type { Update } from "@/lib/store"
import { PlayerLiveTov } from "@/pages/leaderboard/LiveTovPanel"
import { PlayerOldSite } from "@/pages/PlayerOldSite"
import { LeagueRank } from "@/pages/leaderboard/native"
import { Panel } from "@/components/Panel"
import { PanelSearch, type JumpItem } from "@/components/PanelSearch"
import { StatLegend } from "@/components/StatLegend"
import { ChevronRight } from "lucide-react"
import { IconChip } from "@/components/IconChip"
import { Section } from "@/components/Section"
import { panelIcon, sectionIcon } from "@/lib/panelIcons"
import { syncLegacy } from "@/lib/legacy"
import {
  PLAYER_PANELS,
  qualifyingGamesForPlayer,
  teamScore,
  computeLeaderboard,
  computePlayerSectionTeasers,
  downloadTradingCard,
  renderPlayerRankPill,
} from "@/lib/legacy-core"
import type { Toggles } from "@/lib/toggles"
import type { PooleanState } from "@/lib/types"

interface PlayerPanelSpec {
  title: string
  hint: string
  tag: string | null
  open: boolean
  section: string
  order: number
  html: string
  render: (pid: string) => void
  wires: { id: string; evt: string; handler: (e: Event) => void }[]
}

const PANELS = PLAYER_PANELS as PlayerPanelSpec[]

// Same seven groups, in the same order, as the classic Player tab.
const SECTIONS: { key: string; title: string }[] = [
  { key: "shooting", title: "Shooting" },
  { key: "defense", title: "Defense" },
  { key: "passing", title: "Passing & Ball Security" },
  { key: "matchups", title: "Matchups" },
  { key: "team", title: "Team Context" },
  { key: "trends", title: "Trends & History" },
  { key: "media", title: "Media & Log" },
]

// One panel drawn by the classic render function into the panel's original markup (kept under
// .legacy, the scoped classic stylesheet). Re-runs when the player, data, or a toggle changes.
function PlayerPanelBody({ spec, pid, version, opened }: { spec: PlayerPanelSpec; pid: string; version: unknown; opened: number }) {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const ctl = new AbortController()
    spec.wires.forEach((w) => document.getElementById(w.id)?.addEventListener(w.evt, w.handler, { signal: ctl.signal }))
    return () => ctl.abort()
  }, [spec])
  useEffect(() => {
    try {
      spec.render(pid)
      setError(null)
    } catch (e) {
      console.error(`Player panel "${spec.title}" failed`, e)
      setError(String(e))
    }
  }, [spec, pid, version, opened])
  return (
    <>
      {error && <p className="text-sm text-destructive">This panel hit an error: {error}</p>}
      <div className="legacy" dangerouslySetInnerHTML={{ __html: spec.html }} />
    </>
  )
}

function PlayerPanel({ spec, pid, version }: { spec: PlayerPanelSpec; pid: string; version: unknown }) {
  // Charts draw to their container's width, which is 0 while a panel is closed: draw again on open.
  const [opened, setOpened] = useState(0)
  return (
    <details
      open={spec.open}
      className="group scroll-mt-20 rounded-xl border bg-card"
      data-player-panel={spec.title}
      onToggle={(e) => e.currentTarget.open && setOpened((n) => n + 1)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
        <IconChip icon={panelIcon(spec.title, spec.section)} />
        <h3 className="font-display text-base font-bold">{spec.title}</h3>
        {spec.tag && <Badge variant="secondary">{spec.tag}</Badge>}
      </summary>
      <div className="flex min-w-0 flex-col gap-3 p-4 pt-0">
        {spec.hint && <p className="text-sm text-muted-foreground">{spec.hint}</p>}
        <PlayerPanelBody spec={spec} pid={pid} version={version} opened={opened} />
      </div>
    </details>
  )
}

function Panels({ section, pid, version }: { section: string; pid: string; version: unknown }) {
  const layout = useMemo(() => arrange(PANELS, PLAYER_GROUPS), [])
  const body = (p: PlayerPanelSpec, opened: number) => (p.title === "League Rank" ? <LeagueRank pid={pid} /> : <PlayerPanelBody spec={p} pid={pid} version={version} opened={opened} />)
  const entries = layout.get(section) ?? []
  return (
    <>
      {entries.map((p) =>
        p.group ? (
          <PanelBoundary key={p.group.id} title={p.group.title}>
            <PanelGroup title={p.group.title} section={section} frame={entries.length === 1 ? "flat" : "details"} tabs={p.members!.map((m) => ({ title: m.title, label: m.label, hint: m.item.hint, tag: m.item.tag, node: (opened) => body(m.item, opened) }))} />
          </PanelBoundary>
        ) : (
          <PanelBoundary key={p.item!.title} title={p.item!.title}>
            {p.item!.title === "League Rank" ? (
              <Panel title={p.item!.title} hint={p.item!.hint}>
                <LeagueRank pid={pid} />
              </Panel>
            ) : (
              <PlayerPanel spec={p.item!} pid={pid} version={version} />
            )}
          </PanelBoundary>
        ),
      )}
    </>
  )
}

const JUMP_ITEMS: JumpItem[] = PANELS.map((p) => {
  const g = placeOf(p.title, PLAYER_GROUPS)
  const home = g?.home ?? p.section
  return { title: p.title, group: `${SECTIONS.find((s) => s.key === home)?.title ?? "Overview"}${g ? `, ${g.title}` : ""}`, sectionId: home === "overview" ? null : `section-${home}`, hint: p.hint }
})

function fmtRate(v: number) {
  return v.toFixed(1)
}

export function PlayerDetailPage({
  state,
  toggles,
  playerId,
  onChangePlayer,
  update,
  setToggles,
}: {
  state: PooleanState
  toggles: Toggles
  playerId: string | null
  onChangePlayer: (id: string) => void
  update?: Update
  setToggles?: (t: Toggles) => void
}) {
  // The classic compute layer keeps its own copy of the state; refresh it before anything renders.
  const version = useMemo(() => {
    syncLegacy(state, toggles)
    return { state, toggles }
  }, [state, toggles])
  // This season's games for the panels about how they are playing now (see season.ts); their old-site record keeps every result.
  const season = useMemo(() => seasonView(state, toggles.pastSeasons), [state, toggles.pastSeasons])

  // A link names a player by slug. Resolve it forgivingly ("ian" finds "g-ian"); a slug that matches nobody is said so
  // below, never answered with some other player's page.
  const resolved = playerId ? resolvePlayer(state, playerId) : null
  const unknownLink = !!playerId && !resolved
  const player = resolved ?? (playerId ? null : (state.players[0] ?? null))
  const pid = player?.id ?? null
  const row = pid ? (computeLeaderboard() as { player: { id: string }; wins: number; losses: number; ties: number; rate: { pts: number }; offRatingPer25: number; twoWayPer25: number }[]).find((r) => r.player.id === pid) : null
  // Result of each of the last ten counted games, oldest first, for the form strip in the header.
  const form: ("W" | "L" | "T")[] = pid
    ? [...(qualifyingGamesForPlayer(pid) as { date?: string; teamA: string[]; teamB: string[] }[])]
        .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
        .slice(-10)
        .map((g) => {
          const mine = g.teamA.includes(pid) ? g.teamA : g.teamB
          const theirs = mine === g.teamA ? g.teamB : g.teamA
          const a = teamScore(g, mine) as number
          const b = teamScore(g, theirs) as number
          return a > b ? "W" : a < b ? "L" : "T"
        })
    : []
  const teasers = pid ? (computePlayerSectionTeasers(pid) as Record<string, string>) : {}

  useEffect(() => {
    if (pid) renderPlayerRankPill(pid)
  }, [pid, version])

  if (unknownLink) {
    return (
      <div className="flex flex-col gap-3">
        <p>
          No player matches <span className="font-semibold">&quot;{playerId}&quot;</span>. The link may be mistyped. Pick someone:
        </p>
        <div className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <Button key={p.id} size="sm" variant="outline" onClick={() => onChangePlayer(p.id)}>
              {p.name}
            </Button>
          ))}
        </div>
      </div>
    )
  }
  if (!player || !pid) return <p className="text-muted-foreground">No players yet. Add one in the Players tab, then pick them here.</p>

  const record = row ? `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}` : null

  async function share() {
    const url = `${location.origin}${location.pathname}#player=${encodeURIComponent(pid!)}`
    const text = row ? `${player!.name}: ${record}, ${fmtRate(row.twoWayPer25)} Two-Way/25` : player!.name
    if (navigator.share) {
      try {
        await navigator.share({ title: "Poolean Intel", text, url })
        return
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return
      }
    }
    await navigator.clipboard?.writeText(`${text}\n${url}`)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Select value={pid} onValueChange={(id) => id && onChangePlayer(id)}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Pick a player">{player.name}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {state.players.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <PlayerHero
        pid={pid}
        name={player.name}
        form={form}
        stats={row ? { twoWay: fmtRate(row.twoWayPer25), record: record!, pts: fmtRate(row.rate.pts), off: fmtRate(row.offRatingPer25) } : null}
        onShare={share}
        onCard={() => downloadTradingCard(pid)}
      />

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <PanelSearch items={JUMP_ITEMS} placeholder="Jump to a panel, such as shot chart or tips (press /)" />
        </div>
        <StatLegend />
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Player sections">
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            size="sm"
            variant="outline"
            onClick={() => {
              const el = document.getElementById(`section-${s.key}`) as HTMLDetailsElement | null
              if (el) {
                el.open = true
                el.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            }}
          >
            {s.title}
          </Button>
        ))}
      </nav>

      <SeasonSwitch state={state} toggles={toggles} setToggles={setToggles} />
      <Panels section="overview" pid={pid} version={version} />
      <ScoutingCard state={season} pid={pid} update={update} />

      {SECTIONS.map((s) => (
        <Fragment key={s.key}>
          <Section id={`section-${s.key}`} title={s.title} icon={sectionIcon(s.key)} teaser={teasers[s.key] ?? ""}>
            {s.key === "defense" && pid && <PlayerBeatRate state={season} pid={pid} />}
            {s.key === "passing" && pid && <PlayerLiveTov state={season} pid={pid} />}
            <Panels section={s.key} pid={pid} version={version} />
          </Section>
          {/* The sections built in this app sit where they matter: how their games were decided right after the main stat groups,
              game flow and the old site's record after trends, and media last. */}
          {pid && s.key === "passing" && <PlayerInsight state={season} pid={pid} />}
          {pid && s.key === "trends" && (
            <>
              <PlayerGameFlow state={season} pid={pid} />
              <PlayerOldSite state={state} pid={pid} />
            </>
          )}
        </Fragment>
      ))}
    </div>
  )
}
