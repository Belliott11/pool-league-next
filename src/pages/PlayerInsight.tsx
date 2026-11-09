import { Lightbulb } from "lucide-react"
import { useMemo } from "react"
import { ViewTabs } from "@/components/PanelGroup"
import { Section } from "@/components/Section"
import { marginBreakdown, shotsCreated, turnoverCost, winProbAdded } from "@/lib/insight"
import { PER } from "@/lib/per"
import type { PooleanState } from "@/lib/types"
import { bodyEffort } from "@/lib/bodyEffort"
import { pct as ratePct, playerFlow, type Rate } from "@/lib/gameFlow"
import { ZONES, ZONE_LABEL, playerIdentity } from "@/lib/playerIdentity"
import { sequences } from "@/lib/sequences"
import { trustOf } from "@/lib/trust"
import { SIZES, splits, winImpact } from "@/lib/winImpact"
import { FactorBars } from "@/pages/leaderboard/InsightCard"
import { Hint, SureChip, TrustChip } from "@/pages/leaderboard/parts"

const sign = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`
const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`)

const rate = (r: Rate) => (r.att >= 5 ? `${Math.round(ratePct(r)!)}%` : r.att ? `${r.made}/${r.att}` : "-")
const shots = (r: Rate) => `${r.att} shots`

const Line = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex items-baseline gap-2 text-sm">
    <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
  </div>
)

// Their row from each Player deep dive view. Built only when the tab is opened.
function DeepDive({ state, pid }: { state: PooleanState; pid: string }) {
  const w = useMemo(() => winImpact(state), [state])
  const s = useMemo(() => splits(state).find((r) => r.id === pid), [state, pid])
  const q = useMemo(() => sequences(state).rows.find((r) => r.id === pid), [state, pid])
  const hot = useMemo(() => playerFlow(state, pid).hot, [state, pid])
  const d = useMemo(() => playerIdentity(state).rows.find((r) => r.id === pid), [state, pid])
  const h = useMemo(() => bodyEffort(state, w).rows.find((r) => r.id === pid), [state, w, pid])
  const me = w.rows.find((r) => r.id === pid)
  return (
    <>
      {me && (
        <>
          <Line label="Win impact" value={`${sign(me.impact, 0)} pts`} sub={`could be ${sign(me.lo, 0)} to ${sign(me.hi, 0)}, ${me.games} games`} />
          <SureChip v={me.sure} />
          <Hint>Win chance against an average player, with teammates and opponents held constant.</Hint>
        </>
      )}
      {s && SIZES.map((z) => <Line key={z} label={z} value={`${s.size[z].w}-${s.size[z].l}`} />)}
      {s && s.night.map((b, i) => <Line key={i} label={i === 2 ? "Game 3 or later" : `Game ${i + 1} of a night`} value={`${b.w}-${b.l}`} />)}
      {q && (
        <>
          <TrustChip t={trustOf(q.all.att, "shots")} />
          {([["Putbacks", q.putback], ["Off a turnover", q.offTurnover], ["Quick shots", q.quick], ["Settled shots", q.settled], ["Answering a basket", q.answer], ["After a miss", hot.afterMiss]] as const).map(([l, r]) => <Line key={l} label={l} value={rate(r)} sub={shots(r)} />)}
        </>
      )}
      {d && (
        <>
          <Line label="Open shots" value={`${Math.round(d.open * 100)}%`} sub={`${d.shots} shots`} />
          <Line label="Defenders on a shot" value={d.defenders.toFixed(2)} />
          <Line label="Shot choice" value={sign(d.qualityVsLeague, 2)} sub="points per shot against the league" />
          {ZONES.map((z) => d.zones[z].vsLeague !== null && <Line key={z} label={ZONE_LABEL[z]} value={sign(d.zones[z].vsLeague!, 2)} sub={`${d.zones[z].att} shots, against the league`} />)}
        </>
      )}
      {h && ([["Over shorter", h.shooterTaller], ["About even", h.even], ["Over taller", h.shooterShorter]] as const).map(([l, r]) => <Line key={l} label={l} value={rate(r)} sub={shots(r)} />)}
    </>
  )
}

// One player's four insight views beside the league's. A collapsed section like Game flow.
export function PlayerInsight({ state, pid }: { state: PooleanState; pid: string }) {
  const b = useMemo(() => marginBreakdown(state, pid), [state, pid])
  const c = useMemo(() => shotsCreated(state), [state])
  const w = useMemo(() => winProbAdded(state), [state])
  const t = useMemo(() => turnoverCost(state), [state])
  if (b.games === 0) return null
  const mc = c.rows.find((r) => r.id === pid)
  const mw = w.rows.find((r) => r.id === pid)
  const mt = t.rows.find((r) => r.id === pid)
  return (
    <Section id="player-insight" title="What decided their games" icon={Lightbulb} teaser={`How their team's games were won or lost, shots set up, win chance and turnovers. ${b.games} games.`}>
      <ViewTabs
        tabs={[
          {
            value: "decided",
            label: "Their games",
            node: (
              <>
                <Hint>The margin of every finished game this player was in, from their own team's side, split into the parts that made it. A bar to the right helped their team.</Hint>
                <FactorBars b={b} side="their team's" />
              </>
            ),
          },
          {
            value: "created",
            label: "Shots set up",
            node: (
              <>
                <Hint>Shots they passed to a teammate, made or missed, per {PER} points.</Hint>
                {mc ? (
                  <>
                    <Line label={`Set up per ${PER}`} value={mc.created25.toFixed(1)} sub={`${mc.created} shots in ${mc.games} games`} />
                    <Line label="Went in" value={pct(mc.created ? mc.made / mc.created : null)} sub={`league ${pct(c.league.passedFg)} on passed shots`} />
                    <Line label={`Assists per ${PER}`} value={mc.assists25.toFixed(1)} />
                    <Line label="Shot quality" value={`${mc.expected.toFixed(2)} pts`} sub="the league's average on that kind of shot" />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No passes tagged on shots yet.</p>
                )}
              </>
            ),
          },
          {
            value: "chance",
            label: "Win chance added",
            node: (
              <>
                <Hint>How their baskets and passes moved their team's chance of winning, and what shots scored against them while they defended gave up. In points of win chance per {PER} points.</Hint>
                {mw ? (
                  <>
                    <Line label="Added" value={(mw.added25 * 100).toFixed(0)} sub={`${mw.baskets} baskets in ${mw.games} games`} />
                    <Line label="Allowed" value={(mw.allowed25 * 100).toFixed(0)} />
                    <Line label="Net" value={sign(mw.net25 * 100, 0)} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No baskets logged yet.</p>
                )}
              </>
            ),
          },
          {
            value: "deep",
            label: "Deep dive",
            node: <DeepDive state={state} pid={pid} />,
          },
          {
            value: "cost",
            label: "Turnovers",
            node: (
              <>
                <Hint>Live-ball turnovers given away and forced. A stolen or blocked shot is counted as a shot instead. A possession is worth {t.perPossession.toFixed(2)} points in this league.</Hint>
                {mt ? (
                  <>
                    <Line label="Gave away" value={String(mt.giveaways)} sub={`${mt.handed} points scored on the next shot`} />
                    <Line label="Forced" value={String(mt.forced)} sub={`${mt.taken} points scored on the next shot`} />
                    <Line label={`Net pts per ${PER}`} value={sign(mt.net25, 2)} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No turnovers tagged yet.</p>
                )}
              </>
            ),
          },
        ]}
      />
    </Section>
  )
}
