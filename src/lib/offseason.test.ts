import { describe, expect, it } from "vitest"
import { bestGames, careerTable, longestStreaks } from "@/lib/hallOfFame"
import { isOffseason, isOpeningNight } from "@/lib/offseason"
import { duoKey, jumpers, jumpPicks, priorSeason, scorePredictions } from "@/lib/predictions"
import type { Game, PooleanState } from "@/lib/types"
import { wrappedFor } from "@/lib/wrapped"

const base = { stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [] }
// A live-scored game: each side's points come from one basket list.
const game = (id: string, date: string, a: string[], b: string[], pa: number, pb: number): Game => ({
  ...base,
  id,
  date,
  teamA: a,
  teamB: b,
  liveScores: [
    { pid: a[0], points: pa },
    { pid: b[0], points: pb },
  ],
})
const players = ["x", "y", "z", "w"].map((id) => ({ id, name: id.toUpperCase() }))
const state = (games: Game[], extra: Partial<PooleanState> = {}): PooleanState => ({ players, games, ...extra })

describe("offseason switch", () => {
  it("is on only while opening night is in the future", () => {
    const now = new Date("2026-11-04T12:00:00")
    expect(isOffseason(state([]), now)).toBe(false)
    expect(isOffseason(state([], { openingNight: { date: "2027-05-01" } }), now)).toBe(true)
    expect(isOffseason(state([], { openingNight: { date: "2026-11-04", time: "10:00" } }), now)).toBe(false)
  })
})

describe("opening night", () => {
  it("is on from midnight of the date until 8 hours after the start", () => {
    const s = state([], { openingNight: { date: "2026-11-04", time: "19:00" } })
    expect(isOpeningNight(s, new Date("2026-11-04T09:00:00"))).toBe(true)
    expect(isOpeningNight(s, new Date("2026-11-04T23:30:00"))).toBe(true)
    expect(isOpeningNight(s, new Date("2026-11-03T23:00:00"))).toBe(false)
    expect(isOpeningNight(state([], { openingNight: { date: "2026-11-04", time: "10:00" } }), new Date("2026-11-04T19:00:00"))).toBe(false)
  })
})

describe("wrapped", () => {
  const games = [
    game("1", "2026-08-01", ["x", "y"], ["z", "w"], 3, 1),
    game("2", "2026-08-08", ["x", "y"], ["z", "w"], 9, 2),
    game("3", "2026-08-15", ["x", "y"], ["z", "w"], 2, 4),
    game("4", "2026-08-22", ["x", "z"], ["y", "w"], 4, 1),
  ]
  it("picks the best game, best teammate and the most-faced rival", () => {
    const s = wrappedFor(state(games), "x")
    expect(s[0]).toMatchObject({ kind: "intro", gp: 4, w: 3, l: 1 })
    expect(s.find((x) => x.kind === "best")).toMatchObject({ gameId: "2" })
    expect(s.find((x) => x.kind === "teammate")).toMatchObject({ id: "y", w: 2, l: 1 })
    expect(s.find((x) => x.kind === "rival")).toMatchObject({ id: "w", w: 3, l: 1 })
    expect(s.at(-1)?.kind).toBe("summary")
  })
  it("leaves out slides with nothing to say", () => {
    const s = wrappedFor(state([game("1", "2026-08-01", ["x"], ["z"], 2, 1)]), "x")
    expect(s.map((x) => x.kind)).not.toContain("teammate")
    expect(s.map((x) => x.kind)).not.toContain("rival")
    expect(wrappedFor(state([]), "x")).toEqual([])
  })
})

describe("predictions", () => {
  it("scores awards, exact top three spots and top three in the wrong spot", () => {
    const actual = { mvp: "x", dpoy: "y", mip: undefined, duo: duoKey("x", "y"), top3: ["x", "y", "z"], jumps: [] }
    const scored = scorePredictions(
      [
        { voter: "a", picks: { mvp: "x", dpoy: "z", duo: duoKey("y", "x"), top3: ["x", "z", "w"] } },
        { voter: "b", picks: { top3: ["y", "x", "z"] } },
      ],
      actual,
    )
    // a: mvp 2 + duo 2 + x exact 3 + z in top three 1 = 8. b: y and x in the wrong spot 1 + 1, z exact 3 = 5.
    expect(scored).toEqual([
      { voter: "a", points: 8 },
      { voter: "b", points: 5 },
    ])
  })
})

describe("jump picks", () => {
  it("counts a repeat once and puts the most picked first", () => {
    const r = jumpPicks([{ voter: "a", picks: { jumps: ["x", "x", "y"] } }, { voter: "b", picks: { jumps: ["y"] } }, { voter: "c", picks: {} }])
    expect(r).toEqual([{ id: "y", votes: 2 }, { id: "x", votes: 1 }])
  })
  it("calls a move of two spots a jump, among players ranked both seasons", () => {
    // "new" was not ranked before, so it cannot jump and does not shift anyone. z goes from 3rd to 1st.
    expect(jumpers(["x", "y", "z"], ["new", "z", "x", "y"])).toEqual(["z"])
    expect(jumpers(["x", "y"], ["y", "x"])).toEqual([])
  })
  it("finds the season before", () => {
    expect(priorSeason(["2027-06-01", "2026-06-01", "2028-06-01"], "2027-06-01")).toBe("2026-06-01")
    expect(priorSeason(["2027-06-01"], "2027-06-01")).toBe("")
  })
  it("adds a right pick to the points once", () => {
    const actual = { top3: [], jumps: ["z"] }
    expect(scorePredictions([{ voter: "a", picks: { jumps: ["z", "z", "x"] } }], actual)).toEqual([{ voter: "a", points: 2 }])
  })
})

describe("hall of fame", () => {
  const many = Array.from({ length: 10 }, (_, i) => game(String(i), `2026-07-${String(i + 1).padStart(2, "0")}`, ["x"], ["z"], 5, i < 7 ? 1 : 9))
  it("lists careers by games played, and finds the best game and the longest streak", () => {
    const s = state([...many, game("short", "2026-07-20", ["y"], ["w"], 20, 0)])
    expect(careerTable(s).slice(0, 2)).toMatchObject([
      { id: "x", gp: 10, w: 7, pts: 50 },
      { id: "z", gp: 10, w: 3, pts: 34 },
    ])
    expect(bestGames(s, "pts")[0]).toMatchObject({ id: "y", value: 20 })
    expect(longestStreaks(s)[0]).toMatchObject({ id: "x", n: 7 })
  })
})
