import { expect, test } from "vitest"
import { ogContent, standings } from "../../scripts/og-image.mjs"

const state = {
  players: [{ id: "a", name: "Adam" }, { id: "b", name: "Ben" }, { id: "c", name: "Cal" }],
  games: [
    { id: "1", date: "2026-08-10", teamA: ["a"], teamB: ["b"], winner: "A" },
    { id: "2", date: "2026-08-10", teamA: ["a"], teamB: ["c"], winner: "A" },
    { id: "3", date: "2026-08-16", teamA: ["b"], teamB: ["c"], winner: "B" },
    { id: "4", date: "2026-08-16", teamA: ["b"], teamB: ["c"], winner: null },
  ],
  openingNight: { date: "2027-06-01", time: "16:00" },
}

test("standings: most wins first, then the better record; undecided games do not count", () => {
  expect(standings(state).map((r) => `${r.name} ${r.w}-${r.l}`)).toEqual(["Adam 2-0", "Cal 1-1", "Ben 0-2"])
})

test("the countdown drops by a day at the same moment as the site's (opening time, daylight saving included)", () => {
  expect(ogContent(state, new Date("2026-11-24T19:59:00Z")).headline).toBe("In 189 days")
  expect(ogContent(state, new Date("2026-11-24T20:01:00Z")).headline).toBe("In 188 days")
  expect(ogContent(state, new Date("2027-05-31T20:01:00Z")).headline).toBe("In 1 day")
  expect(ogContent(state, new Date("2027-06-01T14:00:00Z")).headline).toBe("Tonight")
  expect(ogContent(state, new Date("2027-06-02T14:00:00Z")).kicker).toBe("Standings")
})
