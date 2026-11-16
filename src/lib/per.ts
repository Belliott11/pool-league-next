import { averageTrips, gameTrips } from "@/lib/possessions"
import type { Game } from "@/lib/types"

// Every counting stat and rating is a per-game number: what the player does over an average game's worth of trips (turns with
// the ball, see possessions.ts). Games are played to different scores, so a plain per-game average would favor whoever plays the
// long ones, and scaling by points scored would flatter a sloppy game. Scaling by trips does neither.
//
// A rate is `(total / sum of gamePace) * PER`. gamePace is a game's length in PER-per-average-game units, so PER cancels and
// the result reads as "per average game". PER stays 25 because a typical game also totals about 25 points, which is what a
// game with no shot log (and so no trips) falls back to.
export const PER = 25
export const DEFAULT_TRIPS = 40 // an average game before any full game is filmed

let avgTrips = DEFAULT_TRIPS

// The league's average is taken from every game, not the season or filter being looked at, so one number means the same
// thing on every page. Called whenever the data changes (App.tsx).
export function setPaceGames(games: Game[]) {
  avgTrips = averageTrips(games) ?? DEFAULT_TRIPS
}
export const averageGameTrips = () => avgTrips

// How much game this was, where an average game is PER.
export function gamePace(g: Game, points: number): number {
  const trips = g.scoringEvents.length > 0 ? gameTrips(g) : 0
  return trips > 0 ? (trips / avgTrips) * PER : points
}
