import { isEvenGame, sizeAllowed } from "@/lib/filters"
import type { Game, PooleanState } from "@/lib/types"

// Per-trip numbers, worked out from the shot log with no extra logging. A trip is one turn with the ball: it ends in a shot the
// other team gets (or a make), or in a live-ball turnover. A miss the shooting team rebounds keeps the same trip going, so
// trips = shots - offensive rebounds + live-ball turnovers. Rates per game flatter a sloppy game; these do not.
// Filmed games with even teams only. Free throws add points but are not counted as trips.
export interface PossRow {
  id: string
  games: number
  trips: number // the player's team's trips in their games
  teamPts: number
  oppTrips: number
  oppPts: number
  used: number // trips the player ended: their shots plus their live-ball turnovers
  pts: number
  tov: number
  teamEnds: number // shots plus live-ball turnovers by their team, the base for usage
}

interface Side {
  trips: number
  pts: number
  ends: number
}

const finishedBox = (g: Game) => g.scoringEvents.length > 0 && !g.liveInProgress && !g.stoppedEarly
const counts = (g: Game) => finishedBox(g) && sizeAllowed(g)

export function gameSides(g: Game): { a: Side; b: Side; used: Map<string, { used: number; pts: number; tov: number }> } {
  const a = { trips: 0, pts: 0, ends: 0 }
  const b = { trips: 0, pts: 0, ends: 0 }
  const used = new Map<string, { used: number; pts: number; tov: number }>()
  const of = (id: string) => used.get(id) ?? used.set(id, { used: 0, pts: 0, tov: 0 }).get(id)!
  const side = (id: string) => (g.teamA.includes(id) ? a : g.teamB.includes(id) ? b : null)
  // A turnover tied to a shot is already counted as that shot.
  const onShot = new Set(g.scoringEvents.map((e) => e.turnoverEventId).filter(Boolean))
  for (const e of g.scoringEvents) {
    const s = side(e.scorerId)
    if (!s) continue
    const made = e.made !== false
    if (made) {
      s.pts += e.points
      of(e.scorerId).pts += e.points
    }
    if (e.points !== 2 && e.points !== 3) continue
    s.trips++
    s.ends++
    of(e.scorerId).used++
    if (!made && e.rebounderId && !e.turnoverEventId && side(e.rebounderId) === s) s.trips--
  }
  for (const t of g.turnoverEvents) {
    const s = side(t.playerId)
    if (!s || t.missEventId || onShot.has(t.id)) continue
    s.trips++
    s.ends++
    const p = of(t.playerId)
    p.used++
    p.tov++
  }
  return { a, b, used }
}

// Both teams' trips in one game.
export const gameTrips = (g: Game) => {
  const { a, b } = gameSides(g)
  return a.trips + b.trips
}

// A full game's trips, on average: filmed, finished games with even teams, whatever the filters say, so the scale never shifts when a
// filter is turned on. null until there is one.
export function averageTrips(games: Game[]): number | null {
  const full = games.filter((g) => finishedBox(g) && isEvenGame(g)).map(gameTrips).filter((t) => t > 0)
  return full.length ? full.reduce((a, b) => a + b, 0) / full.length : null
}

export function possessions(state: PooleanState): { rows: PossRow[]; league: { trips: number; pts: number; games: number } } {
  const rows = new Map<string, PossRow>()
  const league = { trips: 0, pts: 0, games: 0 }
  for (const g of state.games) {
    if (!counts(g)) continue
    const { a, b, used } = gameSides(g)
    league.games++
    league.trips += a.trips + b.trips
    league.pts += a.pts + b.pts
    for (const [team, mine, theirs] of [[g.teamA, a, b], [g.teamB, b, a]] as const) {
      for (const id of team) {
        const r = rows.get(id) ?? rows.set(id, { id, games: 0, trips: 0, teamPts: 0, oppTrips: 0, oppPts: 0, used: 0, pts: 0, tov: 0, teamEnds: 0 }).get(id)!
        const u = used.get(id)
        r.games++
        r.trips += mine.trips
        r.teamPts += mine.pts
        r.oppTrips += theirs.trips
        r.oppPts += theirs.pts
        r.teamEnds += mine.ends
        r.used += u?.used ?? 0
        r.pts += u?.pts ?? 0
        r.tov += u?.tov ?? 0
      }
    }
  }
  return { rows: [...rows.values()].sort((x, y) => y.used - x.used), league }
}

export const perTrip = (pts: number, trips: number) => (trips > 0 ? pts / trips : null)
