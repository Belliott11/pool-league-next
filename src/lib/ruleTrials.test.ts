import { describe, expect, it } from "vitest"
import fs from "node:fs"
import { trialOn, trialResult } from "@/lib/ruleTrials"
import type { PooleanState } from "@/lib/types"

describe.skipIf(!fs.existsSync("public/test-data.json"))("trial rules (live data)", () => {
  it("compares a trial's nights with nights under no trial", () => {
    const state = JSON.parse(fs.readFileSync("public/test-data.json", "utf8")) as PooleanState
    const trial = { id: "t", name: "Line moved in", detail: "", dates: ["2026-08-16"] }
    const withTrial = { ...state, ruleTrials: [trial] }
    const r = trialResult(withTrial, trial)
    const night = state.games.filter((g) => g.date === "2026-08-16" && g.scoringEvents.length > 0 && !g.liveInProgress && !g.test).length
    expect(r.trialGames).toBe(night)
    expect(r.otherGames).toBe(state.games.filter((g) => g.scoringEvents.length > 0 && !g.liveInProgress && !g.test).length - night)
    if (night >= 3) expect(r.rows.some((x) => x.label === "3s made")).toBe(true)
    expect(trialOn(withTrial, "2026-08-16")?.name).toBe("Line moved in")
    expect(trialOn(withTrial, "2026-08-10")).toBeNull()
  })
})
