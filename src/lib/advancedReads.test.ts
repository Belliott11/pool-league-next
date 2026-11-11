import { readFileSync } from "fs"
import { describe, expect, it } from "vitest"
import { advancedReads } from "@/lib/advancedReads"
import type { PooleanState } from "@/lib/types"

const data = JSON.parse(readFileSync("public/test-data.json", "utf8")) as PooleanState

describe("advanced reads", () => {
  it("writes a headline and six lines for each regular, against the league middle", () => {
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
  it("uses each player's pronouns, and they/them when none is set", () => {
    const plain: PooleanState = { ...data, players: data.players.map((p) => ({ ...p, pronouns: undefined })) }
    const text = advancedReads(plain, []).reads.flatMap((r) => r.lines.map((l) => l.text)).join(" ")
    expect(text).not.toMatch(/\b(his|him)\b/)
  })
  it("is empty with no filmed games", () => {
    expect(advancedReads({ players: [], games: [] }, []).reads).toEqual([])
  })
})
