import { Lightbulb } from "lucide-react"
import { useMemo } from "react"
import { ViewTabs } from "@/components/PanelGroup"
import { Section } from "@/components/Section"
import { marginBreakdown, shotsCreated, turnoverCost, winProbAdded } from "@/lib/insight"
import { PER } from "@/lib/per"
import type { PooleanState } from "@/lib/types"
import { FactorBars } from "@/pages/leaderboard/InsightCard"
import { Hint } from "@/pages/leaderboard/parts"

const sign = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`
const pct = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`)

const Line = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex items-baseline gap-2 text-sm">
    <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
  </div>
)

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
            value: "cost",
            label: "Turnovers",
            node: (
              <>
                <Hint>Turnovers given away and forced. A possession is worth {t.perPossession.toFixed(2)} points in this league.</Hint>
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
