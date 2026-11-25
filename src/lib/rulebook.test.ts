import { afterEach, describe, expect, it } from "vitest"
import { currentRules, diffRules, kindOf, rulebook, rulesOn, ruleChanges, sameMathRules, setRulebook, underCurrentRules, type RuleVersion } from "@/lib/rulebook"
import { ruleImpact } from "@/lib/ruleImpact"
import { normalize, hashOf } from "../../scripts/rulebook.mjs"
import type { Game, PooleanState } from "@/lib/types"

const original = rulebook()
afterEach(() => setRulebook(original))

const v1: RuleVersion = {
  from: null,
  hash: "a",
  sections: [
    { n: 1, title: "Scoring", lines: ["2s are worth 2."], subs: [] },
    { n: 6, title: "Contact", lines: [], subs: [{ title: "Off-ball contact", lines: ["Boxing out is allowed.", "Grabbing is prohibited."] }] },
  ],
}
const v2: RuleVersion = { ...v1, from: "2026-08-10", hash: "b", sections: [v1.sections[0], { ...v1.sections[1], subs: [{ title: "Off-ball contact", lines: ["Boxing out is allowed.", "Holding with one arm is allowed."] }] }] }

let n = 0
const game = (date: string, extra: Partial<Game> = {}): Game =>
  ({
    id: `g${n++}`,
    date,
    teamA: ["a"],
    teamB: ["b"],
    stats: [],
    turnoverEvents: [],
    stealEvents: [],
    foulEvents: [],
    scoringEvents: [
      { id: `s${n++}`, scorerId: "a", points: 2, made: true },
      { id: `s${n++}`, scorerId: "b", points: 2, made: false, contestLevel: "heavy" },
      { id: `s${n++}`, scorerId: "a", points: 2, made: true },
    ],
    ...extra,
  }) as unknown as Game

describe("the rulebook over time", () => {
  it("ships with the rulebook read from poolean.net", () => {
    expect(currentRules()?.sections.length).toBeGreaterThan(5)
    expect(rulebook()[0].from).toBeNull()
  })
  it("sorts a change by the section it touched", () => {
    expect(kindOf("Scoring")).toBe("scoring")
    expect(kindOf("Contact: Off-ball contact")).toBe("defense")
    expect(kindOf("Fouls and penalties")).toBe("defense")
    expect(kindOf("Timeouts")).toBe("other")
    expect(kindOf("Boundaries")).toBe("boundaries")
  })
  it("matches games to the rules on their date and lists what changed", () => {
    setRulebook([v1, v2])
    expect(rulesOn("2026-07-29")?.hash).toBe("a")
    expect(rulesOn("2026-08-10")?.hash).toBe("b")
    const d = diffRules(v1, v2)
    expect(d).toEqual([{ section: "Contact: Off-ball contact", kind: "defense", added: ["Holding with one arm is allowed."], removed: ["Grabbing is prohibited."] }])
    expect(ruleChanges()[0].kinds).toEqual(["defense"])
    const state = { games: [game("2026-07-29"), game("2026-08-16")] } as unknown as PooleanState
    expect(underCurrentRules(state).games.map((g) => g.date)).toEqual(["2026-08-16"])
  })
  it("keeps the model rates pooled through a contact change, and splits them on a scoring change once there are enough games", () => {
    const gs = [...Array(10)].map((_, i) => game(i < 5 ? "2026-07-29" : "2026-08-16"))
    setRulebook([v1, v2])
    expect(sameMathRules(gs, "2026-08-16", 3)).toHaveLength(10)
    setRulebook([v1, { ...v1, from: "2026-08-10", hash: "c", sections: [{ ...v1.sections[0], lines: ["2s are worth 2.", "Shots from the deep end are worth 4."] }, v1.sections[1]] }])
    expect(sameMathRules(gs, "2026-08-16", 3)).toHaveLength(5)
    expect(sameMathRules(gs, "2026-08-16", 6)).toHaveLength(10) // too few under the new rules yet
  })
  it("compares the games before and after a change", () => {
    setRulebook([v1, v2])
    const fouls = [{ id: "f1", playerId: "b" }, { id: "f2", playerId: "b" }]
    const state = { games: [...[1, 2, 3].map(() => game("2026-08-01")), ...[1, 2, 3].map(() => game("2026-08-12", { foulEvents: fouls }))] } as unknown as PooleanState
    const r = ruleImpact(state)!
    expect(r.before).toBe(3)
    expect(r.after).toBe(3)
    const f = r.rows.find((x) => x.label.startsWith("Fouls"))!
    expect(f.before).toBe("0.0")
    expect(f.after).toBe("6.7") // 2 fouls a game over 3 trips a game, per 10 trips
  })
  it("reads the rulebook the way the hourly job does", () => {
    const s = normalize([{ n: 2, title: " B ", lines: ["x", ""] }, { n: 1, title: "A", lines: ["y"], subs: [{ title: "s", lines: ["z"] }] }])
    expect(s!.map((x) => x.title)).toEqual(["A", "B"])
    expect(hashOf(s!)).toHaveLength(12)
    expect(normalize({ rules: [] })).toBeNull()
  })
})
