import { expect, it, vi } from "vitest"
import type { Game } from "@/lib/types"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { bigSwings, oddsTimeline } = await import("@/lib/oddsTimeline")

it("follows the odds basket by basket and marks the biggest swings", () => {
  const g = {
    id: "g", date: "2026-08-01", teamA: ["a"], teamB: ["b"], liveTarget: 6, winner: "A", stats: [], scoringEvents: [], turnoverEvents: [], stealEvents: [], foulEvents: [],
    liveScores: [{ pid: "a", points: 2 }, { pid: "b", points: 2 }, { pid: "b", points: 2 }, { pid: "a", points: 2 }, { pid: "a", points: 2 }, { pid: "a", points: 2 }],
  } as unknown as Game
  const t = oddsTimeline(g)
  expect(t.steps).toHaveLength(6)
  expect(t.steps[0].before).toBeCloseTo(t.start, 10)
  for (let i = 1; i < t.steps.length; i++) expect(t.steps[i].before).toBeCloseTo(t.steps[i - 1].after, 10)
  expect(t.steps[0].after).toBeGreaterThan(t.steps[0].before) // Team A scored
  expect(t.steps[1].after).toBeLessThan(t.steps[1].before) // Team B scored
  const last = t.steps.at(-1)!
  expect(last.ends).toBe(true)
  expect(last.after).toBe(1)
  expect(bigSwings(t).has(last.index)).toBe(false)
})
