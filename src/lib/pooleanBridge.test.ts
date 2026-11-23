import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Adam's Poolean Worker (AdamMirmina/poolean, web/src/bridge.ts) reads this site from outside: it fetches public/cloud-config.json,
// reads the league_state row, and posts start, add, undo, finish and review to the live-score function. These tests fail if a change
// here would break it, so the change is made knowing it needs a matching one there.
const root = path.resolve(import.meta.dirname, "../..")
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8")

describe("what the Poolean bridge relies on", () => {
  it("publishes cloud-config.json with url and anonKey", () => {
    const cfg = JSON.parse(read("public/cloud-config.json")) as Record<string, unknown>
    expect(typeof cfg.url).toBe("string")
    expect(String(cfg.url)).toMatch(/^https:\/\/.+\.supabase\.co$/)
    expect(typeof cfg.anonKey).toBe("string")
  })

  it("keeps the live-score actions and fields the bridge sends", () => {
    const fn = read("supabase/functions/live-score/index.ts")
    for (const action of ["start", "add", "undo", "finish", "review"]) expect(fn).toContain(`body.action === "${action}"`)
    for (const field of ["gameId", "pid", "points", "bid", "at", "pA", "teamA", "teamB", "target", "date", "note"]) expect(fn).toMatch(new RegExp(`\\b${field}\\?:`))
  })

  it("marks the live game with liveInProgress", () => {
    expect(read("supabase/functions/live-score/index.ts")).toContain("liveInProgress: true")
    expect(read("src/lib/types.ts")).toContain("liveInProgress")
  })
})
