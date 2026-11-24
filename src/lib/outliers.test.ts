import { afterEach, expect, test, vi } from "vitest"
import { setFilters } from "@/lib/filters"
import { bestGames } from "@/lib/hallOfFame"
import { recordBook } from "@/lib/records"
import { qualifyingGamesForPlayer } from "@/lib/stats"
import type { Game, PooleanState } from "@/lib/types"

// One player's night: `pts` points from made twos, against an even 2 v 2.
const game = (id: string, date: string, pts: number): Game => ({
  id,
  date,
  teamA: ["p", "q"],
  teamB: ["x", "y"],
  winner: "A",
  stats: [{ playerId: "p", pts, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 }],
  scoringEvents: [
    ...Array.from({ length: Math.round(pts / 2) }, (_, i) => ({ id: `${id}-${i}`, scorerId: "p", points: 2 as const, made: true })),
    { id: `${id}-x`, scorerId: "x", points: 2 as const, made: false },
  ],
  turnoverEvents: [],
  stealEvents: [],
  foulEvents: [],
})
const league = (games: Game[]): PooleanState => ({ players: ["p", "q", "x", "y"].map((id) => ({ id, name: id })), games }) as unknown as PooleanState
const ordinary = [game("g1", "2026-07-01", 4), game("g2", "2026-07-02", 4), game("g3", "2026-07-03", 6), game("g4", "2026-07-04", 4)]
const bigNight = game("g5", "2026-07-05", 30)

afterEach(() => setFilters({ imbalanced: false, outliers: true }))

test("leaving outliers out changes a player's averages, never their records or best games", () => {
  const s = league([...ordinary, bigNight])
  setFilters({ outliers: true })
  const withAll = { book: JSON.stringify(recordBook(s)), best: JSON.stringify(bestGames(s, "pts")) }
  expect(qualifyingGamesForPlayer(s, "p").map((g) => g.id)).toContain("g5")
  setFilters({ outliers: false })
  expect(qualifyingGamesForPlayer(s, "p").map((g) => g.id)).not.toContain("g5") // out of the averages
  expect(recordBook(s).pts?.value).toBe(30) // still the record
  expect(JSON.stringify(recordBook(s))).toBe(withAll.book)
  expect(JSON.stringify(bestGames(s, "pts"))).toBe(withAll.best)
})

test("what counts as an outlier is worked out again from the current games each time", () => {
  setFilters({ outliers: false })
  expect(qualifyingGamesForPlayer(league([...ordinary, bigNight]), "p").map((g) => g.id)).not.toContain("g5")
  // More big nights entered: 30 is now an ordinary night for this player, so it counts again.
  const later = [game("g6", "2026-07-06", 28), game("g7", "2026-07-07", 26), game("g8", "2026-07-08", 30), game("g9", "2026-07-09", 24)]
  expect(qualifyingGamesForPlayer(league([...ordinary, bigNight, ...later]), "p").map((g) => g.id)).toContain("g5")
})

test("the classic engine leaves out the same games, before and after new games", async () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  const { syncLegacy } = await import("@/lib/legacy")
  const lc = (await import("@/lib/legacy-core")) as unknown as { qualifyingGamesForPlayer: (id: string) => Game[] }
  const later = [game("g6", "2026-07-06", 28), game("g7", "2026-07-07", 26), game("g8", "2026-07-08", 30), game("g9", "2026-07-09", 24)]
  for (const games of [[...ordinary, bigNight], [...ordinary, bigNight, ...later]]) {
    const s = league(games)
    setFilters({ outliers: false })
    syncLegacy(s, { imbalanced: false, pastSeasons: false, outliers: false })
    expect(lc.qualifyingGamesForPlayer("p").map((g) => g.id)).toEqual(qualifyingGamesForPlayer(s, "p").map((g) => g.id))
  }
  vi.unstubAllGlobals()
})
