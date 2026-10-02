import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PanelBoundary } from "@/components/PanelBoundary"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { LeagueRank } from "@/pages/leaderboard/native"
import { Panel } from "@/components/Panel"
import { Section } from "@/components/Section"
import { syncLegacy } from "@/lib/legacy"
import {
  PLAYER_PANELS,
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
  { key: "passing", title: "Passing & Ball Security" },
  { key: "defense", title: "Defense" },
  { key: "matchups", title: "Matchups" },
  { key: "team", title: "Team Context" },
  { key: "trends", title: "Trends & History" },
  { key: "media", title: "Media & Log" },
]

// One panel drawn by the classic render function into the panel's original markup (kept under
// .legacy, the scoped classic stylesheet). Re-runs when the player, data, or a toggle changes.
function PlayerPanel({ spec, pid, version }: { spec: PlayerPanelSpec; pid: string; version: unknown }) {
  const [error, setError] = useState<string | null>(null)
  // Charts draw to their container's width, which is 0 while a panel is closed: draw again on open.
  const [opened, setOpened] = useState(0)
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
    <details
      open={spec.open}
      className="group rounded-xl border bg-card"
      data-player-panel={spec.title}
      onToggle={(e) => e.currentTarget.open && setOpened((n) => n + 1)}
    >
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

function Panels({ section, pid, version }: { section: string; pid: string; version: unknown }) {
  return (
    <>
      {PANELS.filter((p) => p.section === section)
        .sort((a, b) => a.order - b.order)
        .map((p) => (
          <PanelBoundary key={p.title} title={p.title}>
            {p.title === "League Rank" ? (
              <Panel title={p.title} hint={p.hint}>
                <LeagueRank pid={pid} />
              </Panel>
            ) : (
              <PlayerPanel spec={p} pid={pid} version={version} />
            )}
          </PanelBoundary>
        ))}
    </>
  )
}

function fmtRate(v: number) {
  return v.toFixed(1)
}

export function PlayerDetailPage({
  state,
  toggles,
  playerId,
  onChangePlayer,
}: {
  state: PooleanState
  toggles: Toggles
  playerId: string | null
  onChangePlayer: (id: string) => void
}) {
  // The classic compute layer keeps its own copy of the state; refresh it before anything renders.
  const version = useMemo(() => {
    syncLegacy(state, toggles)
    return { state, toggles }
  }, [state, toggles])

  const player = state.players.find((p) => p.id === playerId) ?? state.players[0] ?? null
  const pid = player?.id ?? null
  const row = pid ? (computeLeaderboard() as { player: { id: string }; wins: number; losses: number; ties: number; rate: { pts: number }; offRatingPer20: number; twoWayPer20: number }[]).find((r) => r.player.id === pid) : null
  const teasers = pid ? (computePlayerSectionTeasers(pid) as Record<string, string>) : {}

  useEffect(() => {
    if (pid) renderPlayerRankPill(pid)
  }, [pid, version])

  if (!player || !pid) return <p className="text-muted-foreground">No players yet.</p>

  const record = row ? `${row.wins}-${row.losses}${row.ties ? `-${row.ties}` : ""}` : null

  async function share() {
    const url = `${location.origin}${location.pathname}#player=${encodeURIComponent(pid!)}`
    const text = row ? `${player!.name}: ${record}, ${fmtRate(row.twoWayPer20)} Two-Way/20` : player!.name
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

      <Card className="tile overflow-hidden">
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <PlayerAvatar id={pid} name={player.name} size="lg" />
            <h2 className="font-display text-2xl font-bold">{player.name}</h2>
            <div id="playerRankPill" className="legacy" />
            <span className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={share}>
                Share
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadTradingCard(pid)}>
                Card
              </Button>
            </span>
          </div>
          {row ? (
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <div className="font-display text-7xl font-extrabold leading-none tabular-nums text-primary sm:text-8xl">{fmtRate(row.twoWayPer20)}</div>
                <div className="mt-1 text-sm text-muted-foreground">Two-Way/20</div>
              </div>
              <dl className="flex gap-6 border-l border-dashed pl-6">
                {[
                  ["Record", record],
                  ["PTS/20", fmtRate(row.rate.pts)],
                  ["Off/20", fmtRate(row.offRatingPer20)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dd className="font-display text-xl font-bold tabular-nums">{v}</dd>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p className="text-muted-foreground">No games yet</p>
          )}
        </CardContent>
      </Card>

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

      <Panels section="overview" pid={pid} version={version} />

      {SECTIONS.map((s) => (
        <Section key={s.key} id={`section-${s.key}`} title={s.title} teaser={teasers[s.key] ?? ""}>
          <Panels section={s.key} pid={pid} version={version} />
        </Section>
      ))}
    </div>
  )
}
