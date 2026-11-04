import { defensiveRating, gameDefenseStats, gameTotalPoints, getGameStats, offensiveRating, qualifyingGamesForPlayer, shootingStats, trueShootingPct } from "@/lib/stats"
import type { PooleanState } from "@/lib/types"

// 2K-style ratings from the box scores. Each player is rated on their last WINDOW box-scored games against everyone
// else who has enough of them, so ratings move as games come in and are relative to the league.
export const MIN_GAMES = 5
export const WINDOW = 20
const MIN_SHOTS = 10

export const ATTRS = ["scoring", "shooting", "playmaking", "rebounding", "defense"] as const
export type Attr = (typeof ATTRS)[number]
export const ATTR_LABEL: Record<Attr, string> = { scoring: "Scoring", shooting: "Shooting", playmaking: "Playmaking", rebounding: "Rebounding", defense: "Defense" }

export interface Rating {
  id: string
  ovr: number
  attrs: Record<Attr, number | null>
  games: number
}

interface Inputs {
  games: number
  twoWay: number
  scoring: number
  shooting: number | null
  playmaking: number
  rebounding: number
  defense: number
}

// Everything per 20 combined points, the same pace adjustment as the standings.
function inputsFor(state: PooleanState, id: string, before?: string): Inputs {
  const games = qualifyingGamesForPlayer(state, id)
    .filter((g) => before === undefined || g.date < before)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-WINDOW)
  let total = 0
  const t = { pts: 0, reb: 0, ast: 0, tov: 0, fga: 0, fta: 0, off: 0, def: 0 }
  for (const g of games) {
    const s = getGameStats(g, id)
    const sh = shootingStats(g, id)
    const d = gameDefenseStats(g, id)
    total += gameTotalPoints(g)
    t.pts += s.pts
    t.reb += s.oreb + s.dreb
    t.ast += s.ast
    t.tov += s.tov
    t.fga += sh.fga
    t.fta += sh.fta
    t.off += offensiveRating(s, sh)
    t.def += defensiveRating(s, d)
  }
  const per20 = (v: number) => (total > 0 ? (v / total) * 20 : 0)
  return {
    games: games.length,
    twoWay: per20(t.off + t.def),
    scoring: per20(t.pts),
    shooting: t.fga >= MIN_SHOTS ? trueShootingPct(t.pts, t.fga, t.fta) : null,
    playmaking: per20(t.ast - 0.5 * t.tov),
    rebounding: per20(t.reb),
    defense: per20(t.def),
  }
}

const toRating = (z: number) => Math.max(40, Math.min(99, Math.round(74 + 9 * z)))

function zScorer(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1)
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length || 1))
  return (v: number) => (sd > 0 ? (v - mean) / sd : 0)
}

// Ratings for everyone with enough box-scored games, optionally as they stood before a date. Best first.
export function ratings(state: PooleanState, before?: string): Rating[] {
  const rated = state.players.map((p) => ({ id: p.id, ...inputsFor(state, p.id, before) })).filter((x) => x.games >= MIN_GAMES)
  if (rated.length === 0) return []
  const z = Object.fromEntries(
    (["twoWay", ...ATTRS] as const).map((k) => [k, zScorer(rated.map((r) => r[k]).filter((v): v is number => v !== null))]),
  ) as Record<"twoWay" | Attr, (v: number) => number>
  return rated
    .map((r) => {
      const attrZ = ATTRS.map((a) => (r[a] === null ? null : z[a](r[a] as number)))
      const present = attrZ.filter((v): v is number => v !== null)
      const ovrZ = 0.6 * z.twoWay(r.twoWay) + 0.4 * (present.reduce((a, b) => a + b, 0) / (present.length || 1))
      return {
        id: r.id,
        ovr: toRating(ovrZ),
        attrs: Object.fromEntries(ATTRS.map((a, i) => [a, attrZ[i] === null ? null : toRating(attrZ[i] as number)])) as Record<Attr, number | null>,
        games: r.games,
      }
    })
    .sort((a, b) => b.ovr - a.ovr)
}

// The latest game night with a box score, which is what the trend is measured from.
export function latestNight(state: PooleanState): string | null {
  const dates = state.games.filter((g) => g.scoringEvents.length > 0 && g.date).map((g) => g.date)
  return dates.length ? dates.sort().at(-1)! : null
}

export interface RatedPlayer extends Rating {
  change: number | null // OVR now minus OVR before the latest night; null when they had no rating then
}

export function ratingsWithTrend(state: PooleanState): { since: string | null; rows: RatedPlayer[] } {
  const since = latestNight(state)
  const now = ratings(state)
  const before = since ? new Map(ratings(state, since).map((r) => [r.id, r.ovr])) : new Map<string, number>()
  return { since, rows: now.map((r) => ({ ...r, change: before.has(r.id) ? r.ovr - before.get(r.id)! : null })) }
}

// How many more box-scored games a player needs before they get a rating (0 when rated).
export const gamesNeeded = (state: PooleanState, id: string) => Math.max(0, MIN_GAMES - qualifyingGamesForPlayer(state, id).length)
