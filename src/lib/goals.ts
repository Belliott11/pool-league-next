import type { SupabaseClient } from "@supabase/supabase-js"
import { deviceKey } from "@/lib/deviceKey"
import { playerLine } from "@/lib/nightRecap"
import { playerGameResult, shootingStats } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// Summer goals: each player picks up to two goals for a season on their own phone (supabase/goals.sql), and their Player page shows how
// close they are, worked out from that season's games. Averages and rates need a few games or shots first (MIN), so one night does not
// read as done. A season is its calendar year: the opening night's when one is set, else this year.
export type GoalKind = "ppg" | "apg" | "rpg" | "threePct" | "ts" | "winPct" | "gamePts" | "gameAst" | "games"

export interface GoalDef {
  kind: GoalKind
  name: string // in the picker
  label: (t: number) => string
  step: number
  pct?: boolean // the target is a percentage
  min: number // games (or shots, for percentages) before it can count as reached
  // The player's number so far, and how much of a sample it rests on.
  value: (games: Game[], pid: string) => { value: number | null; n: number }
}

const played = (games: Game[], pid: string) => games.filter((g) => g.teamA.includes(pid) || g.teamB.includes(pid))
const filmed = (games: Game[], pid: string) => played(games, pid).filter((g) => g.scoringEvents.length > 0)
const avg = (gs: Game[], pid: string, f: (l: ReturnType<typeof playerLine>) => number) => ({ value: gs.length ? gs.reduce((n, g) => n + f(playerLine(g, pid)), 0) / gs.length : null, n: gs.length })

export const GOALS: GoalDef[] = [
  { kind: "ppg", name: "Points a game", label: (t) => `${t} points a game`, step: 0.5, min: 3, value: (gs, p) => avg(played(gs, p), p, (l) => l.pts) },
  { kind: "apg", name: "Assists a game", label: (t) => `${t} assists a game`, step: 0.5, min: 3, value: (gs, p) => avg(filmed(gs, p), p, (l) => l.ast) },
  { kind: "rpg", name: "Rebounds a game", label: (t) => `${t} rebounds a game`, step: 0.5, min: 3, value: (gs, p) => avg(filmed(gs, p), p, (l) => l.reb) },
  {
    kind: "threePct", name: "Percent from 3",
    label: (t) => `${t}% from 3`,
    step: 1,
    pct: true,
    min: 15,
    value: (gs, p) => {
      let m = 0
      let a = 0
      for (const g of filmed(gs, p)) {
        const s = shootingStats(g, p)
        m += s.tpm
        a += s.tpa
      }
      return { value: a ? (m / a) * 100 : null, n: a }
    },
  },
  {
    kind: "ts", name: "True shooting percent",
    label: (t) => `${t}% true shooting`,
    step: 1,
    pct: true,
    min: 20,
    value: (gs, p) => {
      let pts = 0
      let fga = 0
      let fta = 0
      for (const g of filmed(gs, p)) {
        const s = shootingStats(g, p)
        pts += playerLine(g, p).pts
        fga += s.fga
        fta += s.fta
      }
      const tsa = fga + 0.44 * fta
      return { value: tsa ? (pts / (2 * tsa)) * 100 : null, n: fga }
    },
  },
  {
    kind: "winPct", name: "Win percent",
    label: (t) => `Win ${t}% of games`,
    step: 5,
    pct: true,
    min: 5,
    value: (gs, p) => {
      const rs = played(gs, p).map((g) => playerGameResult(g, p)).filter((r) => r === "W" || r === "L")
      return { value: rs.length ? (rs.filter((r) => r === "W").length / rs.length) * 100 : null, n: rs.length }
    },
  },
  { kind: "gamePts", name: "Points in one game", label: (t) => `A ${t}-point game`, step: 1, min: 1, value: (gs, p) => ({ value: played(gs, p).reduce<number | null>((b, g) => Math.max(b ?? 0, playerLine(g, p).pts), null), n: played(gs, p).length }) },
  { kind: "gameAst", name: "Assists in one game", label: (t) => `A ${t}-assist game`, step: 1, min: 1, value: (gs, p) => ({ value: filmed(gs, p).reduce<number | null>((b, g) => Math.max(b ?? 0, playerLine(g, p).ast), null), n: filmed(gs, p).length }) },
  { kind: "games", name: "Games played", label: (t) => `Play ${t} games`, step: 1, min: 0, value: (gs, p) => ({ value: played(gs, p).length, n: played(gs, p).length }) },
]
export const goalDef = (k: string) => GOALS.find((g) => g.kind === k) ?? null

export function goalSeason(state: PooleanState, now: Date = new Date()): string {
  return (state.openingNight?.date ?? "").slice(0, 4) || String(now.getFullYear())
}

const seasonGames = (state: PooleanState, season: string) => state.games.filter((g) => !g.liveInProgress && !g.test && (g.date || "").startsWith(season))

export interface Goal {
  season: string
  player: string
  slot: 1 | 2
  goal: GoalKind
  target: number
  owner: string
}

export interface Progress {
  value: number | null
  n: number
  share: number // 0..1 of the way
  done: boolean
  text: string // "4.2 a game so far, 3 games" or "Not started"
}

export function progress(state: PooleanState, g: Pick<Goal, "goal" | "target" | "player" | "season">): Progress {
  const def = goalDef(g.goal)!
  const { value, n } = def.value(seasonGames(state, g.season), g.player)
  if (value === null || (n === 0 && def.kind !== "games")) return { value: null, n, share: 0, done: false, text: "Nothing yet this season" }
  const share = g.target > 0 ? Math.max(0, Math.min(1, value / g.target)) : 1
  const done = value >= g.target && n >= def.min
  const shown = def.pct ? `${Math.round(value)}%` : Number.isInteger(value) ? String(value) : value.toFixed(1)
  const unit = def.kind === "threePct" || def.kind === "ts" ? `${n} ${n === 1 ? "shot" : "shots"}` : `${n} ${n === 1 ? "game" : "games"}`
  const what = def.kind === "gamePts" || def.kind === "gameAst" ? `best so far ${shown}` : def.kind === "games" ? `${shown} so far` : `${shown} so far`
  const thin = !done && value >= g.target && n < def.min ? `, needs ${def.min} to count` : ""
  return { value, n, share, done, text: def.kind === "games" ? what : `${what}, ${unit}${thin}` }
}

// Last season's number, as a starting point when picking a target.
export function lastSeason(state: PooleanState, kind: GoalKind, pid: string, season: string): number | null {
  const prev = String(Number(season) - 1)
  return goalDef(kind)!.value(seasonGames(state, prev), pid).value
}

export async function loadGoals(client: SupabaseClient, season?: string): Promise<Goal[]> {
  let q = client.from("season_goals").select("season,player,slot,goal,target,owner_hash")
  if (season) q = q.eq("season", season)
  const { data, error } = await q
  if (error || !data) return []
  return data
    .filter((r) => goalDef(String(r.goal)))
    .map((r) => ({ season: String(r.season), player: String(r.player), slot: r.slot === 2 ? 2 : 1, goal: r.goal as GoalKind, target: Number(r.target), owner: String(r.owner_hash) }))
}

export async function saveGoal(client: SupabaseClient, season: string, player: string, slot: 1 | 2, goal: GoalKind | null, target: number | null): Promise<boolean> {
  const { data, error } = await client.rpc("save_season_goal", { p_season: season, p_player: player, p_slot: slot, p_goal: goal, p_target: target, p_key: deviceKey() })
  return !error && data === true
}
