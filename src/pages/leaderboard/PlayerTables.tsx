import { useMemo } from "react"
import { compareRates, pct, PHASES, PHASE_LABEL, PLAYER_PHASE_MIN, VERDICT_LABEL, leagueFlow, playerFlow, type Rate } from "@/lib/gameFlow"
import { FACTORS, FACTOR_LABEL, playerBreakdowns } from "@/lib/insight"
import { playerScoreState, tempo } from "@/lib/tempo"
import type { PooleanState } from "@/lib/types"
import { cn } from "@/lib/utils"
import { trustOf } from "@/lib/trust"
import { Grid, Heat, Hint, TrustChip, Who } from "./parts"

type Open = (id: string) => void
const sign = (v: number, d = 1) => `${v > 0 ? "+" : ""}${v.toFixed(d)}`
const pctText = (r: Rate) => (r.att >= PLAYER_PHASE_MIN ? `${Math.round(pct(r)!)}%` : "-")

// Every player's games from their own team's side: the same five parts as the league bars, one row each, with the cells
// shaded so a column reads as a graph.
export function DecidedPlayers({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const rows = useMemo(() => playerBreakdowns(state), [state])
  if (rows.length === 0) return null
  const max = Math.max(...rows.flatMap((r) => FACTORS.map((f) => Math.abs(r.edge[f]))), 0.5)
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">Each player's games</h4>
      <Hint>Average points a game from each part, from the player's own team's side, so their team's margin is the sum of the five. Darker is bigger. Everyone is in the same games as their teammates, so players on one team move together.</Hint>
      <Grid
        min="44rem"
        head={["Player", "Games", "Margin", ...FACTORS.map((f) => FACTOR_LABEL[f]), "Sample"]}
        rows={rows.map((r) => ({
          key: r.id,
          cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, r.games, sign(r.margin), ...FACTORS.map((f) => <Heat key={f} v={r.edge[f]} max={max} text={sign(r.edge[f])} />), <TrustChip key="t" t={trustOf(r.games, "games")} />],
        }))}
      />
    </section>
  )
}

// First third against last third of the shooting, per player, as a dumbbell: the dot on the left is the first third, the
// dot on the right the last, and the bar between them is how far it moved.
function Dumbbell({ rows, state, onOpenPlayer }: { rows: { id: string; first: number; last: number }[]; state: PooleanState; onOpenPlayer: Open }) {
  const lo = Math.min(...rows.flatMap((r) => [r.first, r.last]), 100)
  const hi = Math.max(...rows.flatMap((r) => [r.first, r.last]), 0)
  const a = Math.max(0, Math.floor(lo / 10) * 10)
  const b = Math.min(100, Math.ceil(hi / 10) * 10)
  const at = (v: number) => `${((v - a) / (b - a || 1)) * 100}%`
  return (
    <div className="flex flex-col gap-1.5" role="img" aria-label="First third and last third shooting for each player">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2 text-sm">
          <div className="w-28 shrink-0"><Who state={state} id={r.id} onOpenPlayer={onOpenPlayer} /></div>
          <div className="relative mx-2 h-4 flex-1">
            <span className="absolute top-1/2 h-px w-full bg-border" />
            <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground/50" style={{ left: at(Math.min(r.first, r.last)), width: `calc(${at(Math.max(r.first, r.last))} - ${at(Math.min(r.first, r.last))})` }} />
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" style={{ left: at(r.first) }} title={`First third ${Math.round(r.first)}%`} />
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" style={{ left: at(r.last) }} title={`Last third ${Math.round(r.last)}%`} />
          </div>
        </div>
      ))}
      <div className="flex justify-between pl-32 pr-2 text-xs text-muted-foreground"><span>{a}%</span><span>{b}%</span></div>
    </div>
  )
}

export function FlowPlayers({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const { rows, league } = useMemo(() => {
    const ids = state.players.map((p) => p.id)
    return {
      league: leagueFlow(state),
      rows: ids.map((id) => ({ id, f: playerFlow(state, id) })).filter((r) => r.f.shots > 0).sort((a, b) => b.f.shots - a.f.shots),
    }
  }, [state])
  if (rows.length === 0 || league.games === 0) return null
  const ok = (r: Rate) => r.att >= PLAYER_PHASE_MIN
  const dumb = rows.filter((r) => ok(r.f.phases[0].shots) && ok(r.f.phases[2].shots)).map((r) => ({ id: r.id, first: pct(r.f.phases[0].shots)!, last: pct(r.f.phases[2].shots)! }))
  return (
    <section className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold">Each player</h4>
      <Hint>Field goal percentage by third of the game, from timed shots. A player needs {PLAYER_PHASE_MIN} shots in a third before it shows. In the chart the hollow dot is the first third and the solid dot the last. With a few dozen shots a player, most gaps are inside the noise, and the label says so.</Hint>
      {dumb.length > 0 && <Dumbbell rows={dumb} state={state} onOpenPlayer={onOpenPlayer} />}
      <Grid
        min="40rem"
        head={["Player", "Shots", ...PHASES.map((p) => PHASE_LABEL[p]), "Last vs first", "Sample"]}
        rows={rows.map((r) => {
          const c = ok(r.f.phases[0].shots) && ok(r.f.phases[2].shots) ? compareRates(r.f.phases[0].shots, r.f.phases[2].shots) : null
          return {
            key: r.id,
            cells: [
              <Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />,
              r.f.shots,
              ...r.f.phases.map((p) => pctText(p.shots)),
              c?.diff != null ? (
                <span key="c" className={cn("whitespace-nowrap", c.verdict === "clear" && "font-semibold text-primary")}>
                  {sign(c.diff, 0)} pts <span className="text-xs font-normal text-muted-foreground">{VERDICT_LABEL[c.verdict]}</span>
                </span>
              ) : (
                "-"
              ),
              <TrustChip key="t" t={trustOf(r.f.shots, "shots")} />,
            ],
          }
        })}
      />
    </section>
  )
}

// Per player: the pace of the games they were in, and their shooting trailing, close and leading.
export function TempoPlayers({ state, onOpenPlayer }: { state: PooleanState; onOpenPlayer: Open }) {
  const rows = useMemo(
    () =>
      state.players
        .map((p) => {
          const theirs = { ...state, games: state.games.filter((g) => g.teamA.includes(p.id) || g.teamB.includes(p.id)) }
          const t = tempo(theirs)
          return { id: p.id, games: t.games, ppm: t.minutes > 0 ? t.plays / t.minutes : null, st: playerScoreState(state, p.id) }
        })
        .filter((r) => r.games > 0)
        .sort((a, b) => b.games - a.games),
    [state],
  )
  if (rows.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">Each player</h4>
      <Hint>Plays per minute is the pace of the timed games a player was in, so teammates share it. Shooting is by the team's margin just before each shot (trailing or leading by 3 or more). A player needs {PLAYER_PHASE_MIN} shots in a state before it shows.</Hint>
      <Grid
        min="38rem"
        head={["Player", "Games", "Plays/min", "Trailing", "Close", "Leading", "Sample"]}
        rows={rows.map((r) => ({
          key: r.id,
          cells: [<Who key="w" state={state} id={r.id} onOpenPlayer={onOpenPlayer} />, r.games, r.ppm === null ? "-" : r.ppm.toFixed(1), pctText(r.st.trailing), pctText(r.st.close), pctText(r.st.leading), <TrustChip key="t" t={trustOf(r.games, "games")} />],
        }))}
      />
    </section>
  )
}
