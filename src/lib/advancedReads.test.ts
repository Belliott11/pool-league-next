import { existsSync, readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { advancedReads } from "@/lib/advancedReads"
import type { PooleanState } from "@/lib/types"

// A copy of the real league data, kept out of the repo (.gitignore). The checks that need it skip when it is not there.
const FILE = "public/test-data.json"
const data = (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { players: [], games: [] }) as PooleanState
const real = existsSync(FILE)

describe("advanced reads", () => {
  it.skipIf(!real)("writes a headline and six lines for each regular, against the league middle", () => {
    const { reads, middle } = advancedReads(data, [])
    expect(reads.length).toBeGreaterThan(3)
    for (const r of reads) {
      expect(r.m.games).toBeGreaterThanOrEqual(3)
      expect(r.headline.length).toBeGreaterThan(10)
      expect(r.lines.map((l) => l.label)).toEqual(["Shooting", "Passing", "Ball", "Defense", "Boards", "Winning"])
      for (const l of r.lines) expect(l.text).not.toMatch(/—|NaN|undefined/)
    }
    expect(middle.ts).toBeGreaterThan(0)
  })
  it.skipIf(!real)("uses each player's pronouns, and they/them when none is set", () => {
    const plain: PooleanState = { ...data, players: data.players.map((p) => ({ ...p, pronouns: undefined })) }
    const text = advancedReads(plain, []).reads.flatMap((r) => r.lines.map((l) => l.text)).join(" ")
    expect(text).not.toMatch(/\b(his|him)\b/)
  })
  it("is empty with no filmed games", () => {
    expect(advancedReads({ players: [], games: [] }, []).reads).toEqual([])
  })
})

describe("written reads", () => {
  it.skipIf(!real)("are for real players, with a headline and no em dashes", async () => {
    const w = (await import("@/data/advanced-reads.json")).default as { filmedGames: number; players: Record<string, { headline: string; text: string[] }> }
    const ids = new Set(data.players.map((p) => p.id))
    for (const [id, r] of Object.entries(w.players)) {
      expect(ids.has(id)).toBe(true)
      expect(r.headline.length).toBeGreaterThan(10)
      expect(JSON.stringify(r)).not.toMatch(/—/)
    }
  })
})
