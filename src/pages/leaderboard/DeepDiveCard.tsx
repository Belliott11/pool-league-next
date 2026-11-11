import { Telescope } from "lucide-react"
import { useMemo } from "react"
import { ViewTabs } from "@/components/PanelGroup"
import { Section } from "@/components/Section"
import { OUTCOMES, OUTCOME_LABEL, TRAITS, TRAIT_LABEL, bodyEffort } from "@/lib/bodyEffort"
import { pct, playerFlow, type Rate } from "@/lib/gameFlow"
import { playerName } from "@/lib/players"
import { ZONES, ZONE_LABEL, playerIdentity } from "@/lib/playerIdentity"
import { QUICK, sequences } from "@/lib/sequences"
import { useReadOnly } from "@/lib/mode"
import { byFormat, type FormatRow, type Rate as FRate } from "@/lib/byFormat"
import { adviceFrom, RULE_LABEL, ruleTests, type RuleVerdict } from "@/lib/ruleTests"
import { trustOf, wilson } from "@/lib/trust"
import type { PooleanState } from "@/lib/types"
import { SIZES, splits, winImpact, type Bucket, type Impact, type WinImpact } from "@/lib/winImpact"
import { Grid, Heat, Hint, SureChip, TrustChip, Who } from "./parts"

type Open = (id: string) => void
const SHOW_GAMES = 5 // results a player needs before their impact is shown
const SHOW_SHOTS = 5 // attempts before a split shows a percentage
const sign = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`
const pc = (v: number | null) => (v === null ? "-" : `${Math.round(v * 100)}%`)
const rate = (r: Rate) => (r.att >= SHOW_SHOTS ? `${Math.round(pct(r)!)}% (${r.att})` : r.att ? `${r.made}/${r.att}` : "-")
const ranged = (r: Rate) => {
  if (r.att === 0) return "-"
  const [a, b] = wilson(r.made, r.att)
  return `${Math.round(pct(r)!)}% (likely ${Math.round(a * 100)} to ${Math.round(b * 100)}, ${r.att} shots)`
}
const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
    <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
    <span className="font-semibold tabular-nums">{value}</span>
  </div>
)
const Title = ({ children }: { children: string }) => <h4 className="text-sm font-semibold">{children}</h4>

// A dot for each player's impact, with a line for the range it could plausibly be, either side of zero.
function Forest({ rows, state, onOpenPlayer }: { rows: Impact[]; state: PooleanState; onOpenPlayer: Open }) {
  const reach = Math.max(...rows.flatMap((r) => [Math.abs(r.lo), Math.abs(r.hi)]), 5)
  const at = (v: number) => `${50 + (v / reach) * 50}%`
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <div className="w-28 shrink-0"><Who state={state} id={r.id} onOpenPlayer={onOpenPlayer} /></div>
          <div className="relative mx-2 h-4 min-w-24 flex-1" role="img" aria-label={`${playerName(state, r.id)} ${sign(r.impact)} points of win chance, range ${sign(r.lo)} to ${sign(r.hi)}`}>
            <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
            <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/50" style={{ left: at(r.lo), width: `calc(${at(r.hi)} - ${at(r.lo)})` }} />
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: at(r.impact) }} />
          </div>
          <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{sign(r.impact, 0)}</span>
          <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{r.games}</span>
          <span className="w-32 shrink-0 text-right"><SureChip v={r.sure} /></span>
        </div>
      ))}
      <div className="hidden justify-between pr-58 pl-32 text-xs text-muted-foreground sm:flex"><span>-{Math.round(reach)}</span><span>0</span><span>+{Math.round(reach)}</span></div>
    </div>
  )
}

const record = (b: Bucket) => (b.w + b.l === 0 ? "-" : `${b.w}-${b.l}`)
function RecordCell({ b }: { b: Bucket }) {
  return (
    <span className="flex flex-col items-end">
      <span>{record(b)}</span>
      {b.shots.att >= SHOW_SHOTS && <span className="text-xs text-muted-foreground">{Math.round(pct(b.shots)!)}% FG</span>}
    </span>
  )
}

function impactNote(w: WinImpact) {
  const { model, baseline } = w.check
  return model < baseline
    ? `Tested by predicting each night from the others, it beat plain win rate (${model.toFixed(3)} against ${baseline.toFixed(3)}, lower is better).`
    : `Tested by predicting each night from the others, it does not beat plain win rate yet (${model.toFixed(3)} against ${baseline.toFixed(3)}, lower is better), so read it as a different angle on the results, not a better one.`
}

function ImpactTab({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const w = useMemo(() => winImpact(state), [state])
  const s = useMemo(() => splits(state), [state])
  const rows = w.rows.filter((r) => r.games >= SHOW_GAMES)
  const games = new Map(w.rows.map((r) => [r.id, r.games]))
  const sp = s.filter((r) => (games.get(r.id) ?? 0) >= SHOW_GAMES).sort((a, b) => (games.get(b.id) ?? 0) - (games.get(a.id) ?? 0))
  if (rows.length === 0) return <Hint>Shows up once there are results to learn from.</Hint>
  return (
    <>
      <Hint>
        Each player's effect on win chance with teammates and opponents held constant, from all {w.check.games} results, including unfilmed games. The line is the plausible range and the small number is games. {impactNote(w)}
      </Hint>
      <Forest rows={rows} state={state} onOpenPlayer={onOpenPlayer} />
      <Title>Record by situation</Title>
      <Hint>Wins and losses by team size and by which game of the night it was, with field goal percentage where there is a box score.</Hint>
      <Grid
        min="36rem"
        head={["Player", ...SIZES, "Game 1", "Game 2", "Game 3+"]}
        rows={sp.map((r) => ({ key: r.id, cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, ...SIZES.map((z) => <RecordCell key={z} b={r.size[z]} />), ...r.night.map((b, i) => <RecordCell key={i} b={b} />)] }))}
      />
    </>
  )
}

function SequenceTab({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const q = useMemo(() => sequences(state), [state])
  const hot = useMemo(() => new Map(q.rows.map((r) => [r.id, playerFlow(state, r.id).hot])), [state, q])
  if (q.games === 0) return <Hint>Shows up once games are logged with video times.</Hint>
  const l = q.league
  return (
    <>
      <Hint>What each shot came straight after, from {q.games} timed games. "Likely" is the range the true rate probably sits in.</Hint>
      <div className="flex flex-col gap-1">
        <Line label="All shots" value={ranged(l.all)} />
        <Line label="Putbacks" value={ranged(l.putback)} />
        <Line label="Off a turnover" value={ranged(l.offTurnover)} />
        <Line label={`Quick (${QUICK} sec or less)`} value={ranged(l.quick)} />
        <Line label="Settled" value={ranged(l.settled)} />
        <Line label="Answering a basket" value={ranged(l.answer)} />
      </div>
      <Grid
        min="44rem"
        head={["Player", "Shots", "Putback", "Off TOV", "Quick", "Settled", "Answer", "After a miss", "Sample"]}
        rows={q.rows.map((r) => ({
          key: r.id,
          cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, r.all.att, rate(r.putback), rate(r.offTurnover), rate(r.quick), rate(r.settled), rate(r.answer), rate(hot.get(r.id)?.afterMiss ?? { made: 0, att: 0 }), <TrustChip key="t" t={trustOf(r.all.att, "shots")} />],
        }))}
      />
    </>
  )
}

function IdentityTab({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const d = useMemo(() => playerIdentity(state), [state])
  if (d.rows.length === 0) return <Hint>Shows up once games are logged shot by shot.</Hint>
  const max = Math.max(...d.rows.flatMap((r) => ZONES.map((z) => Math.abs(r.zones[z].vsLeague ?? 0))), 0.1)
  const hasBeat = d.rows.some((r) => r.gotBeat > 0 || r.openOffBeat > 0)
  return (
    <>
      <Hint>How free a player gets and the shots they choose. Open means nobody is on the shot, including a beaten defender. League: {pc(d.league.open)} open, {d.league.defenders.toFixed(2)} defenders a shot.</Hint>
      <Grid
        min="38rem"
        head={["Player", "Shots", "Open", "Off a pass", "On their own", "Defenders", ...(hasBeat ? ["Got beat (defending)", "Breakdown shots"] : []), "Shot choice", "Sample"]}
        rows={d.rows.map((r) => ({ key: r.id, cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, r.shots, pc(r.open), pc(r.openPassed), pc(r.openSelf), r.defenders.toFixed(2), ...(hasBeat ? [r.gotBeat, r.openOffBeat] : []), sign(r.qualityVsLeague, 2), <TrustChip key="t" t={trustOf(r.shots, "shots")} />] }))}
      />
      <Title>Points per shot by zone, against the league</Title>
      <Hint>Small samples are pulled toward the league. Brackets show shots from there.</Hint>
      <Grid
        min="30rem"
        head={["Player", ...ZONES.map((z) => `${ZONE_LABEL[z]} (${d.league.zones[z]?.toFixed(2) ?? "-"})`)]}
        rows={d.rows.map((r) => ({
          key: r.id,
          cells: [
            <Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />,
            ...ZONES.map((z) => {
              const v = r.zones[z]
              return v.vsLeague === null ? "-" : <Heat key={z} v={v.vsLeague} max={max} text={`${sign(v.vsLeague, 2)} (${v.att})`} />
            }),
          ],
        }))}
      />
    </>
  )
}

function BodyTab({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const b = useMemo(() => bodyEffort(state), [state])
  return (
    <>
      <Hint>Whether size and effort show up in the numbers, across players, as a rank correlation from -1 to +1. Twelve links are tested at once and few players have box scores, so the bar for a label is high. Height is measured. Build and effort are the league's own ratings, so a link can mean people rate good rebounders as hard workers.</Hint>
      <Grid
        min="34rem"
        head={["", ...OUTCOMES.map((o) => OUTCOME_LABEL[o])]}
        rows={TRAITS.map((t) => ({
          key: t,
          cells: [
            <span key="t" className="font-medium">{TRAIT_LABEL[t]}</span>,
            ...OUTCOMES.map((o) => {
              const c = b.grid[t][o]
              return (
                <span key={o} className="flex flex-col items-end gap-0.5">
                  <span>{c.rho === null ? "-" : sign(c.rho, 2)}</span>
                  <SureChip v={c.sure} />
                </span>
              )
            }),
          ],
        }))}
      />
      <Title>Shooting over taller and shorter defenders</Title>
      <Hint>Every guarded shot, by the shooter's height against the average of whoever was on them. Within an inch counts as even.</Hint>
      <div className="flex flex-col gap-1">
        <Line label="Shooter taller" value={ranged(b.league.shooterTaller)} />
        <Line label="About even" value={ranged(b.league.even)} />
        <Line label="Shooter shorter" value={ranged(b.league.shooterShorter)} />
      </div>
      <SureChip v={b.league.tallerVsShorter.verdict} />
      <Grid
        head={["Player", "Over shorter", "Even", "Over taller"]}
        rows={b.rows.map((r) => ({ key: r.id, cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, rate(r.shooterTaller), rate(r.even), rate(r.shooterShorter)] }))}
      />
    </>
  )
}

const RULE_TONE: Record<RuleVerdict, string> = { holds: "border-primary bg-primary/15 text-primary", backwards: "border-gold text-gold", none: "", early: "" }

function HoldUpTab({ state }: { state: PooleanState }) {
  const rules = useMemo(() => ruleTests(state), [state])
  const advice = adviceFrom(rules)
  const order: RuleVerdict[] = ["holds", "backwards", "none", "early"]
  const sorted = [...rules].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict))
  return (
    <>
      <Title>What to do differently</Title>
      {advice.length === 0 ? (
        <Hint>Nothing has enough evidence behind it yet to change how anyone plays.</Hint>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {advice.map((r) => (
            <li key={r.id} className="rounded-lg bg-muted px-3 py-2">{r.advice}</li>
          ))}
        </ul>
      )}
      <Title>Rules from other sports</Title>
      <Hint>Each tested on your games. The bar is high because many are checked at once, and verdicts update as games are logged.</Hint>
      <ul className="flex flex-col gap-3">
        {sorted.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5 border-t pt-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{r.claim}</span>
              <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground ${RULE_TONE[r.verdict]}`}>
                {RULE_LABEL[r.verdict]}{r.strength === "hint" ? ", a hint" : ""}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{r.sport}, {r.n}</span>
            <span className="tabular-nums">{r.numbers}</span>
            {r.note && <span className="text-xs text-muted-foreground">{r.note}</span>}
          </li>
        ))}
      </ul>
    </>
  )
}

// How the game changes with team size. Everything is a rate with its counts, since formats play to different scores.
const FORMAT_LINES: { label: string; get: (r: FormatRow) => FRate; note: string }[] = [
  { label: "Trips ending in a live-ball turnover", get: (r) => r.turnovers, note: "out of trips that ended in a shot or a turnover" },
  { label: "Shots that are threes", get: (r) => r.threes, note: "out of shots" },
  { label: "Threes made", get: (r) => r.threeMade, note: "out of threes" },
  { label: "Shots from close", get: (r) => r.close, note: "out of shots with a spot" },
  { label: "Close shots made", get: (r) => r.closeMade, note: "out of close shots" },
  { label: "Shots that are open", get: (r) => r.open, note: "none, light or beat, out of shots with a contest level" },
  { label: "Open shots made", get: (r) => r.openMade, note: "out of open shots" },
  { label: "Contested shots made", get: (r) => r.contestedMade, note: "medium or heavy" },
  { label: "Made shots assisted", get: (r) => r.assisted, note: "out of made shots" },
  { label: "Misses that are offensive rebounds", get: (r) => r.oreb, note: "out of rebounded misses" },
  { label: "Winning margin as a share of points", get: (r) => r.margin, note: "higher is more lopsided" },
]
const rateText = (r: FRate) => (r.d === 0 ? "-" : `${Math.round((r.n / r.d) * 100)}% (${r.n}/${r.d})`)

function FormatTab({ state }: { state: PooleanState }) {
  const rows = useMemo(() => byFormat(state), [state])
  if (rows.length === 0) return <Hint>No filmed games yet.</Hint>
  return (
    <>
      <Hint>How the game plays at each team size, from filmed games. Formats play to different scores, so these are rates, not totals. Uneven teams are pooled. A format with only a couple of filmed games is a first read.</Hint>
      <Grid
        min={`${14 + rows.length * 8}rem`}
        head={["", ...rows.map((r) => r.format)]}
        rows={[
          { key: "filmed", cells: ["Filmed games", ...rows.map((r) => r.filmed)] },
          { key: "results", cells: ["All results", ...rows.map((r) => r.results)] },
          ...FORMAT_LINES.map((l) => ({
            key: l.label,
            cells: [<span key="l" title={l.note}>{l.label}</span>, ...rows.map((r) => rateText(l.get(r)))],
          })),
        ]}
      />
    </>
  )
}

export function DeepDiveCard({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const readOnly = useReadOnly()
  return (
    <Section id="lb-deep" title="Player deep dive" icon={Telescope} teaser="Win impact, play sequences, who gets open, and which sports rules hold up.">
      <ViewTabs
        tabs={[
          { value: "impact", label: "Win impact", node: <ImpactTab state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "rules", label: "Does it hold up?", node: <HoldUpTab state={state} /> },
          { value: "format", label: "By format", node: <FormatTab state={state} /> },
          { value: "identity", label: "Player identity", node: <IdentityTab state={state} onOpenPlayer={onOpenPlayer} /> },
          { value: "seq", label: "Play sequences", node: <SequenceTab state={state} onOpenPlayer={onOpenPlayer} /> },
          ...(readOnly ? [] : [{ value: "body", label: "Body and effort", node: <BodyTab state={state} onOpenPlayer={onOpenPlayer} /> }]),
        ]}
      />
    </Section>
  )
}
