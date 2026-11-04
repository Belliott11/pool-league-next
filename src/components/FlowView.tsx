import type { ReactNode } from "react"
import {
  compareMeans,
  compareNights,
  compareRates,
  flowSummary,
  laterGames,
  meanOf,
  MIN_NIGHT_GAMES,
  PHASE_LABEL,
  pct,
  PLAYER_HOT_MIN,
  PLAYER_PHASE_MIN,
  VERDICT_LABEL,
  WARM_MIN_SHOTS,
  WARM_UP,
  type Flow,
  type Rate,
  type Verdict,
} from "@/lib/gameFlow"
import { cn } from "@/lib/utils"

const pctText = (r: Rate) => (r.att > 0 ? `${Math.round(pct(r)!)}%` : "-")

// One row: a label, a bar from 0 to max, and the number with what it is made of.
function Row({ label, value, max, text, sub, dim }: { label: string; value: number | null; max: number; text: string; sub?: string; dim?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        {value !== null && <span className={cn("anim-bar block h-full rounded-full", dim ? "bg-muted-foreground/40" : "bg-primary")} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />}
      </div>
      <span className="w-12 shrink-0 text-right font-semibold tabular-nums">{text}</span>
      {sub && <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:inline">{sub}</span>}
    </div>
  )
}

// Whether a difference is real, in words. Never shown without one.
function Verdict({ v, children }: { v: Verdict; children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("rounded-full border px-2 py-0.5 font-medium", v === "clear" && "border-primary bg-primary/15 text-primary", v === "hint" && "border-gold text-gold")}>{VERDICT_LABEL[v]}</span>
      {children}
    </p>
  )
}

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-sm font-semibold">{title}</h4>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(Math.round(n))}`

// Shows one Flow. With `league` it is a player's card: their numbers, the league's beside them, and a phase is hidden
// until they have enough shots in it.
export function FlowView({ flow, league }: { flow: Flow; league?: Flow }) {
  const player = !!league
  const [early, , late] = flow.phases
  const phaseOk = (att: number) => !player || att >= PLAYER_PHASE_MIN
  const shotsNeeded = (att: number) => Math.max(0, PLAYER_PHASE_MIN - att)
  const firstLast = compareRates(early.shots, late.shots)
  const [sEarly, , sLate] = flow.byScore
  const scoreOk = !player || (sEarly.att >= PLAYER_PHASE_MIN && sLate.att >= PLAYER_PHASE_MIN)
  const byScore = compareRates(sEarly, sLate)
  const later = laterGames(flow)
  // A player's night rows need enough shots to mean anything; a league row built from fewer than 3 games is dimmed.
  const nightRows = flow.nights.filter((n) => n.games > 0 && (!player || n.shots.att >= PLAYER_PHASE_MIN))
  const notEnough = player && (early.shots.att < PLAYER_PHASE_MIN || late.shots.att < PLAYER_PHASE_MIN)
  const hotShots = flow.hot.afterMake.att + flow.hot.afterMiss.att
  const warmShots = flow.warm.first.att + flow.warm.rest.att
  const warm = compareRates(flow.warm.rest, flow.warm.first)
  const hot = compareRates(flow.hot.afterMiss, flow.hot.afterMake)
  const contest = compareMeans(early.contest, late.contest)
  const drives = compareRates(early.drives, late.drives)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        {notEnough ? `Not enough shots yet to say anything: ${flow.shots} shots in ${flow.games} ${flow.games === 1 ? "game" : "games"}. Each part of a game needs ${PLAYER_PHASE_MIN}.` : flowSummary(flow)}
      </p>

      <Block title="By part of the game" hint="The game split into three equal stretches of time, from the first shot to the last. The basket that ends a finished game is left out, since a game can only end on a make and that would flatter the last third.">
        {flow.phases.map((p, i) => {
          const ok = phaseOk(p.shots.att)
          const l = league?.phases[i]
          return (
            <div key={p.phase} className="flex flex-col gap-0.5">
              {ok ? (
                <Row label={PHASE_LABEL[p.phase]} value={pct(p.shots)} max={60} text={pctText(p.shots)} sub={`${p.shots.made}/${p.shots.att} shots, ${(p.pts / (p.minutes || 1)).toFixed(1)} pts/min`} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {PHASE_LABEL[p.phase]}: needs {shotsNeeded(p.shots.att)} more shots ({p.shots.att} so far)
                </p>
              )}
              {player && l && ok && <p className="pl-[7.5rem] text-xs text-muted-foreground">League: {pctText(l.shots)}</p>}
            </div>
          )
        })}
        {phaseOk(early.shots.att) && phaseOk(late.shots.att) ? (
          <Verdict v={firstLast.verdict}>{firstLast.diff !== null && <span>Last third against first: {signed(firstLast.diff)} points.</span>}</Verdict>
        ) : (
          <Verdict v="early" />
        )}
      </Block>

      <Block title="By points scored" hint="The same shots, grouped by how far through the game's points it was: the first third of the points, the middle third, the last third. Dead time on the video does not count, and shots are compared at similar game states.">
        {scoreOk ? (
          <>
            {flow.byScore.map((r, i) => (
              <Row key={i} label={["Early points", "Middle points", "Late points"][i]} value={pct(r)} max={60} text={pctText(r)} sub={`${r.made}/${r.att} shots`} />
            ))}
            <Verdict v={byScore.verdict}>{byScore.diff !== null && <span>Late against early: {signed(byScore.diff)} points.</span>}</Verdict>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Needs {PLAYER_PHASE_MIN} shots in the early and late stretch.</p>
        )}
      </Block>

      {nightRows.length > 0 && (
        <Block title="Across a night" hint="Games that share one recording, in the order they were played. Games on their own recording are left out.">
          {nightRows.map((n) => (
            <Row
              key={n.n}
              label={n.n === 3 ? "Game 3 or later" : `Game ${n.n}`}
              value={pct(n.shots)}
              max={60}
              text={pctText(n.shots)}
              dim={n.games < MIN_NIGHT_GAMES}
              sub={`${n.games} ${n.games === 1 ? "game" : "games"}${n.games < MIN_NIGHT_GAMES ? ", too few" : ""}${n.restMinutes.length ? `, ${(n.restMinutes.reduce((a, b) => a + b, 0) / n.restMinutes.length).toFixed(0)} min rest` : ""}`}
            />
          ))}
          <Verdict v={compareNights(flow).verdict}>{later.games > 0 && <span>Needs at least 3 games on each side to compare.</span>}</Verdict>
        </Block>
      )}

      <Block title="Warm-up and hot hand" hint={`Warm-up counts only shooters who took at least ${WARM_MIN_SHOTS} shots in a game, so both groups are the same people. Hot hand follows one shooter through one game.`}>
        {warmShots >= (player ? PLAYER_HOT_MIN : 1) ? (
          <>
            <Row label={`First ${WARM_UP} shots`} value={pct(flow.warm.first)} max={60} text={pctText(flow.warm.first)} sub={`${flow.warm.first.made}/${flow.warm.first.att}`} />
            <Row label="Rest of the game" value={pct(flow.warm.rest)} max={60} text={pctText(flow.warm.rest)} sub={`${flow.warm.rest.made}/${flow.warm.rest.att}`} dim />
            <Verdict v={warm.verdict} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Warm-up needs {PLAYER_HOT_MIN - warmShots} more shots from games with {WARM_MIN_SHOTS} or more ({warmShots} so far).</p>
        )}
        {hotShots >= (player ? PLAYER_HOT_MIN : 1) ? (
          <>
            <Row label="After a make" value={pct(flow.hot.afterMake)} max={60} text={pctText(flow.hot.afterMake)} sub={`${flow.hot.afterMake.made}/${flow.hot.afterMake.att}`} />
            <Row label="After a miss" value={pct(flow.hot.afterMiss)} max={60} text={pctText(flow.hot.afterMiss)} sub={`${flow.hot.afterMiss.made}/${flow.hot.afterMiss.att}`} dim />
            <Verdict v={hot.verdict} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Needs {PLAYER_HOT_MIN - hotShots} more shots ({hotShots} so far).</p>
        )}
      </Block>

      <Block title="Effort" hint="How hard shots are contested (0 none, 3 heavy) and how often a shot is a drive, by part of the game. Fewer contests late can mean defenders are tiring.">
        {phaseOk(early.contest.n) && phaseOk(late.contest.n) ? (
          <>
            {flow.phases.map((p) => (
              <Row key={p.phase} label={PHASE_LABEL[p.phase]} value={meanOf(p.contest)} max={3} text={meanOf(p.contest)?.toFixed(1) ?? "-"} sub={`${pctText(p.drives)} drives`} />
            ))}
            <Verdict v={contest.verdict}>
              <span>Contests: last third against first.</span>
            </Verdict>
            <Verdict v={drives.verdict}>
              <span>Drives: last third against first.</span>
            </Verdict>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Needs more shots with a contest level logged.</p>
        )}
      </Block>

      <p className="text-xs text-muted-foreground">
        {flow.games} {flow.games === 1 ? "game" : "games"} and {flow.shots} shots with video times. This shows patterns, not causes: a late dip could be tiredness, or a trailing team taking harder shots. Games end at a target score, so they vary in length.
        {player && " Everyone's card is checked at once, so a single hint on one player is more likely chance than a real habit."}
      </p>
    </div>
  )
}
