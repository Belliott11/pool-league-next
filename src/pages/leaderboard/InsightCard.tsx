import { Lightbulb } from "lucide-react"
import { useMemo } from "react"
import { ViewTabs } from "@/components/PanelGroup"
import { Section } from "@/components/Section"
import { FACTORS, FACTOR_HINT, FACTOR_LABEL, marginBreakdown, passBlame, shotsCreated, turnoverCost, winProbAdded, type Breakdown } from "@/lib/insight"
import { PER } from "@/lib/per"
import { playerName } from "@/lib/players"
import type { PooleanState } from "@/lib/types"
import { formatDateDisplay } from "@/lib/format"
import { DecidedPlayers } from "./PlayerTables"
import { trustOf } from "@/lib/trust"
import { Grid, Hint, TrustChip, Who } from "./parts"

const sign = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`
const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`)
const EARLY = 5 // games before a split of the margin is more than a handful of cases

// Each factor's average points toward one side, as bars either side of zero, with how many games it went that way.
export function FactorBars({ b, side }: { b: Breakdown; side: string }) {
  const max = Math.max(...FACTORS.map((f) => Math.abs(b.edge[f])), 0.5)
  return (
    <div className="flex flex-col gap-3">
      {FACTORS.map((f) => (
        <div key={f} className="flex flex-col gap-1" title={FACTOR_HINT[f]}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-medium">{FACTOR_LABEL[f]}</span>
            <span className="tabular-nums">
              <span className="font-semibold">{sign(b.edge[f])} pts</span>
              <span className="text-xs text-muted-foreground"> a game, went {side} way in {b.favored[f]} of {b.games}</span>
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-muted" role="img" aria-label={`${FACTOR_LABEL[f]} ${sign(b.edge[f])} points a game`}>
            <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
            <span
              className={b.edge[f] >= 0 ? "absolute inset-y-0 rounded-full bg-primary" : "absolute inset-y-0 rounded-full bg-muted-foreground/60"}
              style={{ width: `${(Math.abs(b.edge[f]) / max) * 50}%`, [b.edge[f] >= 0 ? "left" : "right"]: "50%" }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Decided({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const b = useMemo(() => marginBreakdown(state), [state])
  if (b.games === 0) return <p className="text-sm text-muted-foreground">Shows up once finished games are logged shot by shot.</p>
  return (
    <div className="flex flex-col gap-3">
      <Hint>Every finished game from the winner's side: the margin split into the parts that made it. The parts always add back to the margin. Games won by {b.margin.toFixed(1)} points on average, over {b.games} games.</Hint>
      <FactorBars b={b} side="the winner's" />
      {b.games < EARLY && <Hint>Only {b.games} games so far, so one game can swing any of these.</Hint>}
      <DecidedPlayers state={state} onOpenPlayer={onOpenPlayer} />
    </div>
  )
}

function PassBlameGrid({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const rows = useMemo(() => passBlame(state), [state])
  if (rows.length === 0) return <Hint>Tag contested shots off a pass as catch and shoot or held it, and this shows whose fault the contest was.</Hint>
  const of = (n: number, d: number) => (d === 0 ? "-" : `${n} of ${d} (${Math.round((n / d) * 100)}%)`)
  return (
    <>
      <Hint>Whose fault a medium or heavy contest off a pass was. On their pass: of the contested shots they set up, how many were shot right on the catch, so the pass led into coverage. On them shooting: of their own contested shots off a pass, how many they held first and let the defense recover.</Hint>
      <Grid
        head={["Player", "On their pass", "On them shooting"]}
        rows={rows.map((r) => ({ key: r.id, cells: [<Who key={r.id} state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, of(r.onPass, r.setUps), of(r.held, r.shots)] }))}
      />
    </>
  )
}

function Created({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const c = useMemo(() => shotsCreated(state), [state])
  const rows = c.rows.filter((r) => r.created >= 5)
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Shows up once passes are tagged on shots.</p>
  return (
    <div className="flex flex-col gap-3">
      <Hint>
        Every shot a player passed to a teammate, made or missed, so a passer is not judged only on the makes. Per {PER} points, with players who set up 5 or more shots.
        {c.league.passedFg !== null && c.league.otherFg !== null && ` Shots off a pass went in ${pct(c.league.passedFg)} of the time, against ${pct(c.league.otherFg)} for the rest.`}
      </Hint>
      <Grid
        head={["Player", `Set up/${PER}`, "Went in", `AST/${PER}`, `Real AST/${PER}`, "Shot quality", "Sample"]}
        rows={rows.map((r) => ({ key: r.id, cells: [<Who key={r.id} state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, r.created25.toFixed(1), pct(r.made / r.created), r.assists25.toFixed(1), r.realAssists25.toFixed(1), `${r.expected.toFixed(2)} pts`, <TrustChip key="t" t={trustOf(r.created, "shots")} />] }))}
      />
      <Hint>Shot quality is the league's average points on that kind of shot from that spot (close, mid, line or deep, plus shot type and how closely it was guarded), so it says how good the looks were, not whether they went in. A contested shot the shooter held first is left out of the passer's shot quality, since the contest was on the shooter. Real AST leaves out those makes too: the shooter made them.</Hint>
      <PassBlameGrid state={state} onOpenPlayer={onOpenPlayer} />
    </div>
  )
}

function Chance({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const w = useMemo(() => winProbAdded(state), [state])
  const rows = w.rows.filter((r) => r.games >= 2)
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Shows up once finished games are logged shot by shot.</p>
  return (
    <div className="flex flex-col gap-3">
      <Hint>
        Each made basket moves the scoring team's chance of winning, more late and in close games. The scorer gets the credit (65% of it when a pass led to the basket, 35% to the passer), and defenders on that shot share what was allowed. Games usually end near {w.expectedTotal} points. Shown in points of win chance per {PER} points, so +10 is ten percentage points of win chance.
      </Hint>
      <Grid
        head={["Player", "Added", "Allowed", "Net", "Sample"]}
        rows={rows.map((r) => ({ key: r.id, cells: [<Who key={r.id} state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, (r.added25 * 100).toFixed(0), (r.allowed25 * 100).toFixed(0), sign(r.net25 * 100, 0), <TrustChip key="t" t={trustOf(r.games, "games")} />] }))}
      />
      {w.swings.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">Biggest baskets</p>
          {w.swings.map((s, i) => (
            <p key={i} className="text-sm">
              <span className="font-medium">{playerName(state, s.id)}</span> {s.points === 3 ? "three" : "basket"}, {Math.round(s.from * 100)}% to {Math.round(s.to * 100)}% <span className="text-xs text-muted-foreground">{formatDateDisplay(s.date)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function Cost({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  const t = useMemo(() => turnoverCost(state), [state])
  const rows = t.rows.filter((r) => r.games >= 2)
  if (t.turnovers === 0) return <p className="text-sm text-muted-foreground">Shows up once turnovers are tagged.</p>
  return (
    <div className="flex flex-col gap-3">
      <Hint>
        A possession is worth {t.perPossession.toFixed(2)} points in this league.
        {t.perTurnover !== null && ` The other team's next shot after a turnover scored ${t.perTurnover.toFixed(2)} points on average (${t.followed} cases), so ${t.perTurnover > t.perPossession ? "a giveaway costs a little more than a typical possession" : "a giveaway costs about a typical possession"}.`}
      </Hint>
      <Grid
        head={["Player", "Gave", "Forced", `Net pts/${PER}`, "Sample"]}
        rows={rows.map((r) => ({ key: r.id, cells: [<Who key={r.id} state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, String(r.giveaways), String(r.forced), sign(r.net25, 2), <TrustChip key="t" t={trustOf(r.games, "games")} />] }))}
      />
      <Hint>Live-ball turnovers only: a stolen or blocked shot is already counted as a shot. Net is turnovers forced minus turnovers given away, at the league's points per possession.</Hint>
    </div>
  )
}

// League view: four tabs from the same logged games. A collapsed section like Game flow, built only when opened.
export function InsightCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: (id: string) => void }) {
  return (
    <Section id="lb-insight" title="What decided games" icon={Lightbulb} teaser="Why games went the way they did, who sets up shots, win chance and what turnovers cost.">
      <ViewTabs
        tabs={[
          { value: "decided", label: "What decided games", node: <Decided state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "chance", label: "Win chance added", node: <Chance state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "cost", label: "Turnover cost", node: <Cost state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "created", label: "Shots set up", node: <Created state={state} onOpenPlayer={onOpenPlayer} /> },
        ]}
      />
    </Section>
  )
}
