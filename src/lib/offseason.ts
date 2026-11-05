import { scoreOf } from "@/lib/nightRecap"
import { oldSite, type OldSite } from "@/lib/oldSite"
import { computeLeaderboard, isCurrentSeasonGame } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// The offseason is the stretch before opening night, once the editor has set its date.
export function openingAt(state: PooleanState): Date | null {
  const o = state.openingNight
  if (!o?.date) return null
  const d = new Date(`${o.date}T${o.time || "00:00"}:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export const isOffseason = (state: PooleanState, now = new Date()): boolean => {
  const at = openingAt(state)
  return !!at && at.getTime() > now.getTime()
}

// Opening night itself: from midnight of its date until 8 hours after it starts. The hub turns into a live board.
export const isOpeningNight = (state: PooleanState, now = new Date()): boolean => {
  const at = openingAt(state)
  if (!at || state.openingNight?.date !== now.toLocaleDateString("en-CA")) return false
  return now.getTime() < at.getTime() + 8 * 3600 * 1000
}

// The hub shows before opening night and through the night itself.
export const showHub = (state: PooleanState, now = new Date()) => isOffseason(state, now) || isOpeningNight(state, now)

// The season just played: finished games with a result in the current season. During the offseason this is the season
// that just ended, until the editor starts a new one.
export function seasonGames(state: PooleanState): Game[] {
  return state.games
    .filter((g) => !g.liveInProgress && g.date && isCurrentSeasonGame(state, g))
    .filter((g) => {
      const [a, b] = scoreOf(g)
      return a !== b
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export const seasonState = (state: PooleanState): PooleanState => ({ ...state, games: seasonGames(state) })

// The way-too-early power ranking: this season's two-way per 25, at least 3 games, with each player's record.
export function powerRanking(state: PooleanState) {
  return computeLeaderboard(seasonState(state))
    .filter((r) => r.gp >= 3)
    .sort((a, b) => b.twoWayPer25 - a.twoWayPer25)
}

export interface EarlyRow {
  id: string
  score: number // 0 to 100: the average of whichever of the three measures below the player has
  twoWayPer25?: number
  wins?: number
  losses?: number
  oldPower?: number // the old site's season power percentile, pulled toward 50 for few games
}

// The way-too-early ranking with the old site folded in. Three measures, each on a 0 to 100 scale, averaged over the ones
// a player has: where their two-way per 25 sits among this season's rated players, the old site's season power, and
// their last three nights on the old site's power ranking. That is how players whose games were never filmed still rank.
export function earlyRanking(state: PooleanState, old: OldSite = oldSite()): EarlyRow[] {
  const rated = powerRanking(state)
  const byId = new Map(rated.map((r, i) => [r.player.id, { r, pct: rated.length > 1 ? (1 - i / (rated.length - 1)) * 100 : 50 }]))
  const out: EarlyRow[] = []
  for (const p of state.players) {
    const own = byId.get(p.id)
    const recent = (old.ranks.get(p.id) ?? []).slice(-3)
    const oldPower = old.power.get(p.id)
    const parts = [own?.pct, oldPower, recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : undefined].filter((x): x is number => x !== undefined)
    if (parts.length === 0) continue
    out.push({ id: p.id, score: parts.reduce((a, b) => a + b, 0) / parts.length, twoWayPer25: own?.r.twoWayPer25, wins: own?.r.wins, losses: own?.r.losses, oldPower })
  }
  return out.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

// Who goes on a preseason ballot: every player in the app. The starting order is best by the numbers first, then the
// rest of this season's players by most games, then everyone else by name.
export function ballotPool(state: PooleanState): string[] {
  const gp = new Map<string, number>()
  for (const g of seasonGames(state)) for (const id of [...g.teamA, ...g.teamB]) gp.set(id, (gp.get(id) ?? 0) + 1)
  const ranked = earlyRanking(state).map((r) => r.id)
  const rest = [...state.players]
    .filter((p) => !ranked.includes(p.id))
    .sort((a, b) => (gp.get(b.id) ?? 0) - (gp.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .map((p) => p.id)
  return [...ranked, ...rest]
}
