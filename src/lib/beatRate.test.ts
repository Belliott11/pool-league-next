import { describe, expect, it } from "vitest"
import { beatRates, count, isTransition, TRANSITION_SECONDS } from "@/lib/beatRate"
import type { Game, PooleanState, ScoringEvent } from "@/lib/types"

const shot = (id: string, t: number, level: ScoringEvent["contestLevel"], made = true, extra: Partial<ScoringEvent> = {}): ScoringEvent => ({ id, scorerId: "a", points: 2, made, videoTime: t, contestLevel: level, defenderIds: ["d"], ...extra })
const game = (events: ScoringEvent[], extra: Partial<Game> = {}): Game => ({ id: "g", date: "2026-08-10", teamA: ["a"], teamB: ["d"], stats: [], scoringEvents: events, turnoverEvents: [], stealEvents: [], foulEvents: [], ...extra })
const state = (g: Game): PooleanState => ({ players: [{ id: "a", name: "A" }, { id: "d", name: "D" }], games: [g] })

describe("beat rate", () => {
  it("counts beat shots out of every shot faced, and leaves beat shots out of opponent FG%", () => {
    const g = game([shot("1", 10, "beat"), shot("2", 40, "heavy", false), shot("3", 80, "light"), shot("4", 120, "beat")])
    const r = beatRates(state(g)).find((x) => x.id === "d")!
    expect([r.faced, r.beat]).toEqual([4, 2])
    expect([r.oppMade, r.oppAtt]).toEqual([1, 2])
  })
  it("splits a double-teamed shot between its defenders", () => {
    const g = game([shot("1", 10, "beat", true, { defenderIds: ["d", "e"] }), shot("2", 40, "heavy", true)], { teamA: ["a", "b"], teamB: ["d", "e"] })
    const d = beatRates(state(g)).find((x) => x.id === "d")!
    const e = beatRates(state(g)).find((x) => x.id === "e")!
    expect([d.faced, d.beat, d.oppMade, d.oppAtt]).toEqual([1.5, 0.5, 1, 1])
    expect([e.faced, e.beat]).toEqual([0.5, 0.5])
    expect(count(1.5)).toBe("1.5")
    expect(count(2)).toBe("2")
  })
  it("calls a shot transition when a turnover or steal came just before it, and half court otherwise", () => {
    const g = game([shot("1", 50, "beat"), shot("2", 200, "beat"), shot("3", 300, "light")], {
      turnoverEvents: [{ id: "t", playerId: "d", videoTime: 50 - TRANSITION_SECONDS + 1 }],
      stealEvents: [{ id: "s", playerId: "a", opponentId: "d", videoTime: 190 }],
    })
    expect(isTransition(g, g.scoringEvents[0])).toBe(true)
    expect(isTransition(g, g.scoringEvents[1])).toBe(false) // the steal was 10 seconds earlier
    expect(isTransition(g, g.scoringEvents[2])).toBe(false) // the latest event is a shot
    const r = beatRates(state(g)).find((x) => x.id === "d")!
    expect([r.tFaced, r.tBeat, r.hFaced, r.hBeat]).toEqual([1, 1, 2, 1])
  })
  it("does not count a stolen or blocked shot's own turnover as the event before it", () => {
    const s = shot("1", 50, "beat", false, { turnoverEventId: "t" })
    const g = game([s], { turnoverEvents: [{ id: "t", playerId: "a", missEventId: "1", videoTime: 49 }] })
    expect(isTransition(g, s)).toBe(false)
  })
  it("skips uneven teams and games stopped early", () => {
    expect(beatRates(state(game([shot("1", 10, "beat")], { teamA: ["a", "x"] })))).toEqual([])
    expect(beatRates(state(game([shot("1", 10, "beat")], { stoppedEarly: true })))).toEqual([])
  })
})
