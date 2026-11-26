import { describe, expect, it, vi } from "vitest"
import fs from "node:fs"
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} })
const { makeCaptainLinks, parseCaptainLink, sha256 } = await import("@/lib/draftRoom")
const st = await import("@/lib/seasonTeams")

describe("draft room", () => {
  it("the season-draft function runs the same snake as the site", () => {
    expect(fs.readFileSync("supabase/functions/season-draft/seasonDraft.ts", "utf8")).toBe(fs.readFileSync("src/lib/seasonDraft.ts", "utf8"))
  })
  it("makes one link per team whose key matches only the saved hash", async () => {
    const set = st.newSet("2027-06-01", [{ name: "Sharks", captain: "a" }, { name: "Jets", captain: "b" }])
    const r = await makeCaptainLinks(set)
    expect(r.links).toHaveLength(2)
    for (const l of r.links) {
      const parsed = parseCaptainLink(decodeURIComponent(l.url.split("#/games/teams/")[1]))!
      expect(parsed.setId).toBe(set.id)
      expect(await sha256(parsed.key)).toBe(r.keys[parsed.teamId])
      expect(r.keys[parsed.teamId === set.teams[0].id ? set.teams[1].id : set.teams[0].id]).not.toBe(await sha256(parsed.key))
    }
    expect(JSON.stringify(r.keys)).not.toContain(parseCaptainLink(decodeURIComponent(r.links[0].url.split("#/games/teams/")[1]))!.key)
  })
  it("rejects a link without a long enough key", () => {
    expect(parseCaptainLink("s.t.short")).toBeNull()
    expect(parseCaptainLink("nonsense")).toBeNull()
  })
})
