import { Gauge } from "lucide-react"
import { useMemo, type ReactNode } from "react"
import { Section } from "@/components/Section"
import { MIN_SIDE_SHOTS, PHASE_LABEL, pct, VERDICT_LABEL, compareRates, type Rate, type Verdict } from "@/lib/gameFlow"
import { formatDateDisplay } from "@/lib/format"
import { GAP_CAP, MIN_RUN_BASKETS, TRAIL, tempo } from "@/lib/tempo"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"

const pctText = (r: Rate) => (r.att > 0 ? `${Math.round(pct(r)!)}%` : "-")

function Tag({ v }: { v: Verdict }) {
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground", v === "clear" && "border-primary bg-primary/15 text-primary", v === "hint" && "border-gold text-gold")}>{VERDICT_LABEL[v]}</span>
}

function Block({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-sm font-semibold">{title}</h4>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {children}
    </section>
  )
}

const Line = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="flex items-baseline gap-2 text-sm">
    <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
    {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
  </div>
)

// Pace, scoring runs, lead swings and shooting by score state for the league, from games with video times. A collapsed
// section like Game flow, built only when opened.
export function TempoCard({ state }: { state: PooleanState }) {
  const t = useMemo(() => tempo(state), [state])
  const teaser = t.games === 0 ? "Needs games logged shot by shot with video times." : `How fast games go, who runs off points and how leads swing. ${t.games} games.`
  const ppm = t.minutes > 0 ? t.plays / t.minutes : 0
  const trailVsLead = compareRates(t.state.trailing, t.state.leading)
  const s = t.runs.streaky
  return (
    <Section id="lb-tempo" title="Pace, runs and swings" icon={Gauge} teaser={teaser}>
      {t.games === 0 ? (
        <p className="text-sm text-muted-foreground">Games show up here once they are logged shot by shot, with video times and 12 or more shots.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Block title="Pace" hint={`There is no possession count, so this counts logged plays (every shot and turnover) and the time between neighbouring plays. Gaps over ${GAP_CAP} seconds are treated as breaks in the video.`}>
            <Line label="Plays per minute" value={ppm.toFixed(1)} sub={`${t.plays} plays in ${t.minutes.toFixed(0)} min`} />
            <Line label="Time between plays" value={t.gapMedian !== null ? `${t.gapMedian.toFixed(0)} sec` : "-"} sub="the middle gap, a stand-in for how long a possession lasts" />
            {t.phases.map((p) => (
              <Line key={p.phase} label={PHASE_LABEL[p.phase]} value={`${(p.plays / (p.minutes || 1)).toFixed(1)} plays/min`} sub={p.gaps.n ? `${(p.gaps.sum / p.gaps.n).toFixed(0)} sec between plays` : undefined} />
            ))}
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Tag v={t.paceDrift.verdict} />
              {t.paceDrift.diff !== null && <span>{t.paceDrift.diff > 0 ? "Slower" : "Faster"} by {Math.abs(t.paceDrift.diff).toFixed(0)} sec between plays in the last third than the first.</span>}
            </p>
          </Block>

          <Block title="Scoring runs" hint={`Unanswered baskets by one team. Only games with ${MIN_RUN_BASKETS} or more made baskets count, and the number of runs is compared with what a random order of the same baskets would give.`}>
            {t.runs.top.length === 0 ? (
              <p className="text-sm text-muted-foreground">No game has enough baskets yet.</p>
            ) : (
              t.runs.top.map((r, i) => <Line key={i} label={i === 0 ? "Biggest runs" : ""} value={`${r.points} pts`} sub={`${r.baskets} straight baskets, ${formatDateDisplay(r.date)}`} />)
            )}
            {s.z !== null && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Tag v={s.verdict} />
                <span>
                  {s.observed} runs over {s.games} games against about {s.expected.toFixed(0)} expected from chance
                  {s.verdict !== "early" ? (s.z < 0 ? ": scoring comes in streaks." : ": scoring trades back and forth more than chance.") : "."}
                </span>
              </p>
            )}
            {s.z === null && <Tag v="early" />}
          </Block>

          <Block title="Lead swings" hint="Built from the order of made baskets in each game.">
            <Line label="Lead changes" value={(t.swings.leadChanges / (t.swings.games || 1)).toFixed(1)} sub={`per game, over ${t.swings.games} games`} />
            <Line label="Ties" value={(t.swings.ties / (t.swings.games || 1)).toFixed(1)} sub="per game" />
            <Line label="Games won from behind" value={`${t.swings.withComeback} of ${t.swings.games}`} sub="the winner trailed at some point" />
            {t.swings.comebacks.map((c, i) => (
              <Line key={i} label={i === 0 ? "Biggest comebacks" : ""} value={`${c.deficit} pts down`} sub={formatDateDisplay(c.date)} />
            ))}
          </Block>

          <Block title="Shooting by score" hint={`Shots grouped by the shooter's team margin just before the shot: trailing by ${TRAIL} or more, within ${TRAIL - 1}, or leading by ${TRAIL} or more. The basket that ends a game is left out.`}>
            {([["Trailing", t.state.trailing], ["Close", t.state.close], ["Leading", t.state.leading]] as const).map(([label, r]) => (
              <Line key={label} label={label} value={pctText(r)} sub={`${r.made}/${r.att} shots${r.att < MIN_SIDE_SHOTS ? ", too few" : ""}`} />
            ))}
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Tag v={trailVsLead.verdict} />
              {trailVsLead.diff !== null && <span>Leading against trailing: {trailVsLead.diff > 0 ? "+" : ""}{Math.round(trailVsLead.diff)} points. Being ahead and shooting well feed each other, so this shows who is hot as much as what the score does to anyone.</span>}
            </p>
          </Block>
        </div>
      )}
    </Section>
  )
}
